#   Copyright 2017-2019 object_database Authors
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.

import boto3
import datetime
import logging
import os
import time
import uuid
from typed_python import OneOf, ConstDict, NamedTuple
from object_database import ServiceBase, Schema, Indexed, Index
from object_database.web import cells
from object_database.util import closest_N_in
from object_database.service_manager.ServiceSchema import service_schema

schema = Schema("core.AwsWorkerBootService")


# a dictionary of instance name ->
#   RAM (in GiB)
#   CPU (number of vcpus)
#   COST (the price in USD per hour)
valid_instance_types = {
    "a1.2xlarge": {"COST": 0.204, "CPU": 8, "RAM": 16.0},
    "a1.4xlarge": {"COST": 0.408, "CPU": 16, "RAM": 32.0},
    "a1.large": {"COST": 0.051, "CPU": 2, "RAM": 4.0},
    "a1.medium": {"COST": 0.0255, "CPU": 1, "RAM": 2.0},
    "a1.metal": {"COST": 0.408, "CPU": 16, "RAM": 32.0},
    "a1.xlarge": {"COST": 0.102, "CPU": 4, "RAM": 8.0},
    "c1.medium": {"COST": 0.13, "CPU": 2, "RAM": 1.7},
    "c1.xlarge": {"COST": 0.52, "CPU": 8, "RAM": 7.0},
    "c3.2xlarge": {"COST": 0.42, "CPU": 8, "RAM": 15.0},
    "c3.4xlarge": {"COST": 0.84, "CPU": 16, "RAM": 30.0},
    "c3.8xlarge": {"COST": 1.68, "CPU": 32, "RAM": 60.0},
    "c3.large": {"COST": 0.105, "CPU": 2, "RAM": 3.75},
    "c3.xlarge": {"COST": 0.21, "CPU": 4, "RAM": 7.5},
    "c4.2xlarge": {"COST": 0.398, "CPU": 8, "RAM": 15.0},
    "c4.4xlarge": {"COST": 0.796, "CPU": 16, "RAM": 30.0},
    "c4.8xlarge": {"COST": 1.591, "CPU": 36, "RAM": 60.0},
    "c4.large": {"COST": 0.1, "CPU": 2, "RAM": 3.75},
    "c4.xlarge": {"COST": 0.199, "CPU": 4, "RAM": 7.5},
    "c5.12xlarge": {"COST": 2.04, "CPU": 48, "RAM": 96.0},
    "c5.18xlarge": {"COST": 3.06, "CPU": 72, "RAM": 144.0},
    "c5.24xlarge": {"COST": 4.08, "CPU": 96, "RAM": 192.0},
    "c5.2xlarge": {"COST": 0.34, "CPU": 8, "RAM": 16.0},
    "c5.4xlarge": {"COST": 0.68, "CPU": 16, "RAM": 32.0},
    "c5.9xlarge": {"COST": 1.53, "CPU": 36, "RAM": 72.0},
    "c5.large": {"COST": 0.085, "CPU": 2, "RAM": 4.0},
    "c5.metal": {"COST": 4.08, "CPU": 96, "RAM": 192.0},
    "c5.xlarge": {"COST": 0.17, "CPU": 4, "RAM": 8.0},
    "c5a.12xlarge": {"COST": 1.848, "CPU": 48, "RAM": 96.0},
    "c5a.16xlarge": {"COST": 2.464, "CPU": 64, "RAM": 128.0},
    "c5a.24xlarge": {"COST": 3.696, "CPU": 96, "RAM": 192.0},
    "c5a.2xlarge": {"COST": 0.308, "CPU": 8, "RAM": 16.0},
    "c5a.4xlarge": {"COST": 0.616, "CPU": 16, "RAM": 32.0},
    "c5a.8xlarge": {"COST": 1.232, "CPU": 32, "RAM": 64.0},
    "c5a.large": {"COST": 0.077, "CPU": 2, "RAM": 4.0},
    "c5a.xlarge": {"COST": 0.154, "CPU": 4, "RAM": 8.0},
    "c5ad.12xlarge": {"COST": 2.064, "CPU": 48, "RAM": 96.0},
    "c5ad.16xlarge": {"COST": 2.752, "CPU": 64, "RAM": 128.0},
    "c5ad.24xlarge": {"COST": 4.128, "CPU": 96, "RAM": 192.0},
    "c5ad.2xlarge": {"COST": 0.344, "CPU": 8, "RAM": 16.0},
    "c5ad.4xlarge": {"COST": 0.688, "CPU": 16, "RAM": 32.0},
    "c5ad.8xlarge": {"COST": 1.376, "CPU": 32, "RAM": 64.0},
    "c5ad.large": {"COST": 0.086, "CPU": 2, "RAM": 4.0},
    "c5ad.xlarge": {"COST": 0.172, "CPU": 4, "RAM": 8.0},
    "c5d.12xlarge": {"COST": 2.304, "CPU": 48, "RAM": 96.0},
    "c5d.18xlarge": {"COST": 3.456, "CPU": 72, "RAM": 144.0},
    "c5d.24xlarge": {"COST": 4.608, "CPU": 96, "RAM": 192.0},
    "c5d.2xlarge": {"COST": 0.384, "CPU": 8, "RAM": 16.0},
    "c5d.4xlarge": {"COST": 0.768, "CPU": 16, "RAM": 32.0},
    "c5d.9xlarge": {"COST": 1.728, "CPU": 36, "RAM": 72.0},
    "c5d.large": {"COST": 0.096, "CPU": 2, "RAM": 4.0},
    "c5d.metal": {"COST": 4.608, "CPU": 96, "RAM": 192.0},
    "c5d.xlarge": {"COST": 0.192, "CPU": 4, "RAM": 8.0},
    "c5n.18xlarge": {"COST": 3.888, "CPU": 72, "RAM": 192.0},
    "c5n.2xlarge": {"COST": 0.432, "CPU": 8, "RAM": 21.0},
    "c5n.4xlarge": {"COST": 0.864, "CPU": 16, "RAM": 42.0},
    "c5n.9xlarge": {"COST": 1.944, "CPU": 36, "RAM": 96.0},
    "c5n.large": {"COST": 0.108, "CPU": 2, "RAM": 5.25},
    "c5n.metal": {"COST": 3.888, "CPU": 72, "RAM": 192.0},
    "c5n.xlarge": {"COST": 0.216, "CPU": 4, "RAM": 10.5},
    "c6a.12xlarge": {"COST": 1.836, "CPU": 48, "RAM": 96.0},
    "c6a.16xlarge": {"COST": 2.448, "CPU": 64, "RAM": 128.0},
    "c6a.24xlarge": {"COST": 3.672, "CPU": 96, "RAM": 192.0},
    "c6a.2xlarge": {"COST": 0.306, "CPU": 8, "RAM": 16.0},
    "c6a.32xlarge": {"COST": 4.896, "CPU": 128, "RAM": 256.0},
    "c6a.48xlarge": {"COST": 7.344, "CPU": 192, "RAM": 384.0},
    "c6a.4xlarge": {"COST": 0.612, "CPU": 16, "RAM": 32.0},
    "c6a.8xlarge": {"COST": 1.224, "CPU": 32, "RAM": 64.0},
    "c6a.large": {"COST": 0.0765, "CPU": 2, "RAM": 4.0},
    "c6a.metal": {"COST": 7.344, "CPU": 192, "RAM": 384.0},
    "c6a.xlarge": {"COST": 0.153, "CPU": 4, "RAM": 8.0},
    "c6g.12xlarge": {"COST": 1.632, "CPU": 48, "RAM": 96.0},
    "c6g.16xlarge": {"COST": 2.176, "CPU": 64, "RAM": 128.0},
    "c6g.2xlarge": {"COST": 0.272, "CPU": 8, "RAM": 16.0},
    "c6g.4xlarge": {"COST": 0.544, "CPU": 16, "RAM": 32.0},
    "c6g.8xlarge": {"COST": 1.088, "CPU": 32, "RAM": 64.0},
    "c6g.large": {"COST": 0.068, "CPU": 2, "RAM": 4.0},
    "c6g.medium": {"COST": 0.034, "CPU": 1, "RAM": 2.0},
    "c6g.metal": {"COST": 2.176, "CPU": 64, "RAM": 128.0},
    "c6g.xlarge": {"COST": 0.136, "CPU": 4, "RAM": 8.0},
    "c6gd.12xlarge": {"COST": 1.8432, "CPU": 48, "RAM": 96.0},
    "c6gd.16xlarge": {"COST": 2.4576, "CPU": 64, "RAM": 128.0},
    "c6gd.2xlarge": {"COST": 0.3072, "CPU": 8, "RAM": 16.0},
    "c6gd.4xlarge": {"COST": 0.6144, "CPU": 16, "RAM": 32.0},
    "c6gd.8xlarge": {"COST": 1.2288, "CPU": 32, "RAM": 64.0},
    "c6gd.large": {"COST": 0.0768, "CPU": 2, "RAM": 4.0},
    "c6gd.medium": {"COST": 0.0384, "CPU": 1, "RAM": 2.0},
    "c6gd.metal": {"COST": 2.4576, "CPU": 64, "RAM": 128.0},
    "c6gd.xlarge": {"COST": 0.1536, "CPU": 4, "RAM": 8.0},
    "c6gn.12xlarge": {"COST": 2.0736, "CPU": 48, "RAM": 96.0},
    "c6gn.16xlarge": {"COST": 2.7648, "CPU": 64, "RAM": 128.0},
    "c6gn.2xlarge": {"COST": 0.3456, "CPU": 8, "RAM": 16.0},
    "c6gn.4xlarge": {"COST": 0.6912, "CPU": 16, "RAM": 32.0},
    "c6gn.8xlarge": {"COST": 1.3824, "CPU": 32, "RAM": 64.0},
    "c6gn.large": {"COST": 0.0864, "CPU": 2, "RAM": 4.0},
    "c6gn.medium": {"COST": 0.0432, "CPU": 1, "RAM": 2.0},
    "c6gn.xlarge": {"COST": 0.1728, "CPU": 4, "RAM": 8.0},
    "c6i.12xlarge": {"COST": 2.04, "CPU": 48, "RAM": 96.0},
    "c6i.16xlarge": {"COST": 2.72, "CPU": 64, "RAM": 128.0},
    "c6i.24xlarge": {"COST": 4.08, "CPU": 96, "RAM": 192.0},
    "c6i.2xlarge": {"COST": 0.34, "CPU": 8, "RAM": 16.0},
    "c6i.32xlarge": {"COST": 5.44, "CPU": 128, "RAM": 256.0},
    "c6i.4xlarge": {"COST": 0.68, "CPU": 16, "RAM": 32.0},
    "c6i.8xlarge": {"COST": 1.36, "CPU": 32, "RAM": 64.0},
    "c6i.large": {"COST": 0.085, "CPU": 2, "RAM": 4.0},
    "c6i.metal": {"COST": 5.44, "CPU": 128, "RAM": 256.0},
    "c6i.xlarge": {"COST": 0.17, "CPU": 4, "RAM": 8.0},
    "c6id.12xlarge": {"COST": 2.4192, "CPU": 48, "RAM": 96.0},
    "c6id.16xlarge": {"COST": 3.2256, "CPU": 64, "RAM": 128.0},
    "c6id.24xlarge": {"COST": 4.8384, "CPU": 96, "RAM": 192.0},
    "c6id.2xlarge": {"COST": 0.4032, "CPU": 8, "RAM": 16.0},
    "c6id.32xlarge": {"COST": 6.4512, "CPU": 128, "RAM": 256.0},
    "c6id.4xlarge": {"COST": 0.8064, "CPU": 16, "RAM": 32.0},
    "c6id.8xlarge": {"COST": 1.6128, "CPU": 32, "RAM": 64.0},
    "c6id.large": {"COST": 0.1008, "CPU": 2, "RAM": 4.0},
    "c6id.metal": {"COST": 6.4512, "CPU": 128, "RAM": 256.0},
    "c6id.xlarge": {"COST": 0.2016, "CPU": 4, "RAM": 8.0},
    "c6in.12xlarge": {"COST": 2.7216, "CPU": 48, "RAM": 96.0},
    "c6in.16xlarge": {"COST": 3.6288, "CPU": 64, "RAM": 128.0},
    "c6in.24xlarge": {"COST": 5.4432, "CPU": 96, "RAM": 192.0},
    "c6in.2xlarge": {"COST": 0.4536, "CPU": 8, "RAM": 16.0},
    "c6in.32xlarge": {"COST": 7.2576, "CPU": 128, "RAM": 256.0},
    "c6in.4xlarge": {"COST": 0.9072, "CPU": 16, "RAM": 32.0},
    "c6in.8xlarge": {"COST": 1.8144, "CPU": 32, "RAM": 64.0},
    "c6in.large": {"COST": 0.1134, "CPU": 2, "RAM": 4.0},
    "c6in.metal": {"COST": 7.2576, "CPU": 128, "RAM": 256.0},
    "c6in.xlarge": {"COST": 0.2268, "CPU": 4, "RAM": 8.0},
    "c7g.12xlarge": {"COST": 1.74, "CPU": 48, "RAM": 96.0},
    "c7g.16xlarge": {"COST": 2.32, "CPU": 64, "RAM": 128.0},
    "c7g.2xlarge": {"COST": 0.29, "CPU": 8, "RAM": 16.0},
    "c7g.4xlarge": {"COST": 0.58, "CPU": 16, "RAM": 32.0},
    "c7g.8xlarge": {"COST": 1.16, "CPU": 32, "RAM": 64.0},
    "c7g.large": {"COST": 0.0725, "CPU": 2, "RAM": 4.0},
    "c7g.medium": {"COST": 0.0363, "CPU": 1, "RAM": 2.0},
    "c7g.metal": {"COST": 2.32, "CPU": 64, "RAM": 128.0},
    "c7g.xlarge": {"COST": 0.145, "CPU": 4, "RAM": 8.0},
    "c7gd.12xlarge": {"COST": 2.1773, "CPU": 48, "RAM": 96.0},
    "c7gd.16xlarge": {"COST": 2.903, "CPU": 64, "RAM": 128.0},
    "c7gd.2xlarge": {"COST": 0.3629, "CPU": 8, "RAM": 16.0},
    "c7gd.4xlarge": {"COST": 0.7258, "CPU": 16, "RAM": 32.0},
    "c7gd.8xlarge": {"COST": 1.4515, "CPU": 32, "RAM": 64.0},
    "c7gd.large": {"COST": 0.0907, "CPU": 2, "RAM": 4.0},
    "c7gd.medium": {"COST": 0.0454, "CPU": 1, "RAM": 2.0},
    "c7gd.xlarge": {"COST": 0.1814, "CPU": 4, "RAM": 8.0},
    "c7gn.12xlarge": {"COST": 2.9952, "CPU": 48, "RAM": 96.0},
    "c7gn.16xlarge": {"COST": 3.9936, "CPU": 64, "RAM": 128.0},
    "c7gn.2xlarge": {"COST": 0.4992, "CPU": 8, "RAM": 16.0},
    "c7gn.4xlarge": {"COST": 0.9984, "CPU": 16, "RAM": 32.0},
    "c7gn.8xlarge": {"COST": 1.9968, "CPU": 32, "RAM": 64.0},
    "c7gn.large": {"COST": 0.1248, "CPU": 2, "RAM": 4.0},
    "c7gn.medium": {"COST": 0.0624, "CPU": 1, "RAM": 2.0},
    "c7gn.xlarge": {"COST": 0.2496, "CPU": 4, "RAM": 8.0},
    "cr1.8xlarge": {"COST": 3.5, "CPU": 32, "RAM": 244.0},
    "d2.2xlarge": {"COST": 1.38, "CPU": 8, "RAM": 61.0},
    "d2.4xlarge": {"COST": 2.76, "CPU": 16, "RAM": 122.0},
    "d2.8xlarge": {"COST": 5.52, "CPU": 36, "RAM": 244.0},
    "d2.xlarge": {"COST": 0.69, "CPU": 4, "RAM": 30.5},
    "d3.2xlarge": {"COST": 0.999, "CPU": 8, "RAM": 64.0},
    "d3.4xlarge": {"COST": 1.998, "CPU": 16, "RAM": 128.0},
    "d3.8xlarge": {"COST": 3.9955, "CPU": 32, "RAM": 256.0},
    "d3.xlarge": {"COST": 0.499, "CPU": 4, "RAM": 32.0},
    "d3en.12xlarge": {"COST": 6.3086, "CPU": 48, "RAM": 192.0},
    "d3en.2xlarge": {"COST": 1.051, "CPU": 8, "RAM": 32.0},
    "d3en.4xlarge": {"COST": 2.103, "CPU": 16, "RAM": 64.0},
    "d3en.6xlarge": {"COST": 3.154, "CPU": 24, "RAM": 96.0},
    "d3en.8xlarge": {"COST": 4.2058, "CPU": 32, "RAM": 128.0},
    "d3en.xlarge": {"COST": 0.526, "CPU": 4, "RAM": 16.0},
    "dl1.24xlarge": {"COST": 13.109, "CPU": 96, "RAM": 768.0},
    "f1.16xlarge": {"COST": 13.2, "CPU": 64, "RAM": 976.0},
    "f1.2xlarge": {"COST": 1.65, "CPU": 8, "RAM": 122.0},
    "f1.4xlarge": {"COST": 3.3, "CPU": 16, "RAM": 244.0},
    "g2.2xlarge": {"COST": 0.65, "CPU": 8, "RAM": 15.0},
    "g2.8xlarge": {"COST": 2.6, "CPU": 32, "RAM": 60.0},
    "g3.16xlarge": {"COST": 4.56, "CPU": 64, "RAM": 488.0},
    "g3.4xlarge": {"COST": 1.14, "CPU": 16, "RAM": 122.0},
    "g3.8xlarge": {"COST": 2.28, "CPU": 32, "RAM": 244.0},
    "g3s.xlarge": {"COST": 0.75, "CPU": 4, "RAM": 30.5},
    "g4ad.16xlarge": {"COST": 3.468, "CPU": 64, "RAM": 256.0},
    "g4ad.2xlarge": {"COST": 0.5412, "CPU": 8, "RAM": 32.0},
    "g4ad.4xlarge": {"COST": 0.867, "CPU": 16, "RAM": 64.0},
    "g4ad.8xlarge": {"COST": 1.734, "CPU": 32, "RAM": 128.0},
    "g4ad.xlarge": {"COST": 0.3785, "CPU": 4, "RAM": 16.0},
    "g4dn.12xlarge": {"COST": 3.912, "CPU": 48, "RAM": 192.0},
    "g4dn.16xlarge": {"COST": 4.352, "CPU": 64, "RAM": 256.0},
    "g4dn.2xlarge": {"COST": 0.752, "CPU": 8, "RAM": 32.0},
    "g4dn.4xlarge": {"COST": 1.204, "CPU": 16, "RAM": 64.0},
    "g4dn.8xlarge": {"COST": 2.176, "CPU": 32, "RAM": 128.0},
    "g4dn.metal": {"COST": 7.824, "CPU": 96, "RAM": 384.0},
    "g4dn.xlarge": {"COST": 0.526, "CPU": 4, "RAM": 16.0},
    "g5.12xlarge": {"COST": 5.672, "CPU": 48, "RAM": 192.0},
    "g5.16xlarge": {"COST": 4.096, "CPU": 64, "RAM": 256.0},
    "g5.24xlarge": {"COST": 8.144, "CPU": 96, "RAM": 384.0},
    "g5.2xlarge": {"COST": 1.212, "CPU": 8, "RAM": 32.0},
    "g5.48xlarge": {"COST": 16.288, "CPU": 192, "RAM": 768.0},
    "g5.4xlarge": {"COST": 1.624, "CPU": 16, "RAM": 64.0},
    "g5.8xlarge": {"COST": 2.448, "CPU": 32, "RAM": 128.0},
    "g5.xlarge": {"COST": 1.006, "CPU": 4, "RAM": 16.0},
    "g5g.16xlarge": {"COST": 2.744, "CPU": 64, "RAM": 128.0},
    "g5g.2xlarge": {"COST": 0.556, "CPU": 8, "RAM": 16.0},
    "g5g.4xlarge": {"COST": 0.828, "CPU": 16, "RAM": 32.0},
    "g5g.8xlarge": {"COST": 1.372, "CPU": 32, "RAM": 64.0},
    "g5g.metal": {"COST": 2.744, "CPU": 64, "RAM": 128.0},
    "g5g.xlarge": {"COST": 0.42, "CPU": 4, "RAM": 8.0},
    "h1.16xlarge": {"COST": 3.744, "CPU": 64, "RAM": 256.0},
    "h1.2xlarge": {"COST": 0.468, "CPU": 8, "RAM": 32.0},
    "h1.4xlarge": {"COST": 0.936, "CPU": 16, "RAM": 64.0},
    "h1.8xlarge": {"COST": 1.872, "CPU": 32, "RAM": 128.0},
    "hpc7g.16xlarge": {"COST": 1.6832, "CPU": 64, "RAM": 128.0},
    "hpc7g.4xlarge": {"COST": 1.6832, "CPU": 16, "RAM": 128.0},
    "hpc7g.8xlarge": {"COST": 1.6832, "CPU": 32, "RAM": 128.0},
    "i2.2xlarge": {"COST": 1.705, "CPU": 8, "RAM": 61.0},
    "i2.4xlarge": {"COST": 3.41, "CPU": 16, "RAM": 122.0},
    "i2.8xlarge": {"COST": 6.82, "CPU": 32, "RAM": 244.0},
    "i2.xlarge": {"COST": 0.853, "CPU": 4, "RAM": 30.5},
    "i3.16xlarge": {"COST": 4.992, "CPU": 64, "RAM": 488.0},
    "i3.2xlarge": {"COST": 0.624, "CPU": 8, "RAM": 61.0},
    "i3.4xlarge": {"COST": 1.248, "CPU": 16, "RAM": 122.0},
    "i3.8xlarge": {"COST": 2.496, "CPU": 32, "RAM": 244.0},
    "i3.large": {"COST": 0.156, "CPU": 2, "RAM": 15.25},
    "i3.metal": {"COST": 4.992, "CPU": 72, "RAM": 512.0},
    "i3.xlarge": {"COST": 0.312, "CPU": 4, "RAM": 30.5},
    "i3en.12xlarge": {"COST": 5.424, "CPU": 48, "RAM": 384.0},
    "i3en.24xlarge": {"COST": 10.848, "CPU": 96, "RAM": 768.0},
    "i3en.2xlarge": {"COST": 0.904, "CPU": 8, "RAM": 64.0},
    "i3en.3xlarge": {"COST": 1.356, "CPU": 12, "RAM": 96.0},
    "i3en.6xlarge": {"COST": 2.712, "CPU": 24, "RAM": 192.0},
    "i3en.large": {"COST": 0.226, "CPU": 2, "RAM": 16.0},
    "i3en.metal": {"COST": 10.848, "CPU": 96, "RAM": 768.0},
    "i3en.xlarge": {"COST": 0.452, "CPU": 4, "RAM": 32.0},
    "i4g.16xlarge": {"COST": 4.9421, "CPU": 64, "RAM": 512.0},
    "i4g.2xlarge": {"COST": 0.6178, "CPU": 8, "RAM": 64.0},
    "i4g.4xlarge": {"COST": 1.2355, "CPU": 16, "RAM": 128.0},
    "i4g.8xlarge": {"COST": 2.471, "CPU": 32, "RAM": 256.0},
    "i4g.large": {"COST": 0.1544, "CPU": 2, "RAM": 16.0},
    "i4g.xlarge": {"COST": 0.3089, "CPU": 4, "RAM": 32.0},
    "i4i.16xlarge": {"COST": 5.491, "CPU": 64, "RAM": 512.0},
    "i4i.2xlarge": {"COST": 0.686, "CPU": 8, "RAM": 64.0},
    "i4i.32xlarge": {"COST": 10.9824, "CPU": 128, "RAM": 1024.0},
    "i4i.4xlarge": {"COST": 1.373, "CPU": 16, "RAM": 128.0},
    "i4i.8xlarge": {"COST": 2.746, "CPU": 32, "RAM": 256.0},
    "i4i.large": {"COST": 0.172, "CPU": 2, "RAM": 16.0},
    "i4i.metal": {"COST": 10.982, "CPU": 128, "RAM": 1024.0},
    "i4i.xlarge": {"COST": 0.343, "CPU": 4, "RAM": 32.0},
    "im4gn.16xlarge": {"COST": 5.8207, "CPU": 64, "RAM": 256.0},
    "im4gn.2xlarge": {"COST": 0.7276, "CPU": 8, "RAM": 32.0},
    "im4gn.4xlarge": {"COST": 1.4552, "CPU": 16, "RAM": 64.0},
    "im4gn.8xlarge": {"COST": 2.9103, "CPU": 32, "RAM": 128.0},
    "im4gn.large": {"COST": 0.1819, "CPU": 2, "RAM": 8.0},
    "im4gn.xlarge": {"COST": 0.3638, "CPU": 4, "RAM": 16.0},
    "inf1.24xlarge": {"COST": 4.721, "CPU": 96, "RAM": 192.0},
    "inf1.2xlarge": {"COST": 0.362, "CPU": 8, "RAM": 16.0},
    "inf1.6xlarge": {"COST": 1.18, "CPU": 24, "RAM": 48.0},
    "inf1.xlarge": {"COST": 0.228, "CPU": 4, "RAM": 8.0},
    "inf2.24xlarge": {"COST": 6.4906, "CPU": 96, "RAM": 384.0},
    "inf2.48xlarge": {"COST": 12.9813, "CPU": 192, "RAM": 768.0},
    "inf2.8xlarge": {"COST": 1.9679, "CPU": 32, "RAM": 128.0},
    "inf2.xlarge": {"COST": 0.7582, "CPU": 4, "RAM": 16.0},
    "is4gen.2xlarge": {"COST": 1.1526, "CPU": 8, "RAM": 48.0},
    "is4gen.4xlarge": {"COST": 2.3052, "CPU": 16, "RAM": 96.0},
    "is4gen.8xlarge": {"COST": 4.6104, "CPU": 32, "RAM": 192.0},
    "is4gen.large": {"COST": 0.2882, "CPU": 2, "RAM": 12.0},
    "is4gen.medium": {"COST": 0.1441, "CPU": 1, "RAM": 6.0},
    "is4gen.xlarge": {"COST": 0.5763, "CPU": 4, "RAM": 24.0},
    "m1.large": {"COST": 0.175, "CPU": 2, "RAM": 7.5},
    "m1.medium": {"COST": 0.087, "CPU": 1, "RAM": 3.75},
    "m1.small": {"COST": 0.044, "CPU": 1, "RAM": 1.7},
    "m1.xlarge": {"COST": 0.35, "CPU": 4, "RAM": 15.0},
    "m2.2xlarge": {"COST": 0.49, "CPU": 4, "RAM": 34.2},
    "m2.4xlarge": {"COST": 0.98, "CPU": 8, "RAM": 68.4},
    "m2.xlarge": {"COST": 0.245, "CPU": 2, "RAM": 17.1},
    "m3.2xlarge": {"COST": 0.532, "CPU": 8, "RAM": 30.0},
    "m3.large": {"COST": 0.133, "CPU": 2, "RAM": 7.5},
    "m3.medium": {"COST": 0.067, "CPU": 1, "RAM": 3.75},
    "m3.xlarge": {"COST": 0.266, "CPU": 4, "RAM": 15.0},
    "m4.10xlarge": {"COST": 2.0, "CPU": 40, "RAM": 160.0},
    "m4.16xlarge": {"COST": 3.2, "CPU": 64, "RAM": 256.0},
    "m4.2xlarge": {"COST": 0.4, "CPU": 8, "RAM": 32.0},
    "m4.4xlarge": {"COST": 0.8, "CPU": 16, "RAM": 64.0},
    "m4.large": {"COST": 0.1, "CPU": 2, "RAM": 8.0},
    "m4.xlarge": {"COST": 0.2, "CPU": 4, "RAM": 16.0},
    "m5.12xlarge": {"COST": 2.304, "CPU": 48, "RAM": 192.0},
    "m5.16xlarge": {"COST": 3.072, "CPU": 64, "RAM": 256.0},
    "m5.24xlarge": {"COST": 4.608, "CPU": 96, "RAM": 384.0},
    "m5.2xlarge": {"COST": 0.384, "CPU": 8, "RAM": 32.0},
    "m5.4xlarge": {"COST": 0.768, "CPU": 16, "RAM": 64.0},
    "m5.8xlarge": {"COST": 1.536, "CPU": 32, "RAM": 128.0},
    "m5.large": {"COST": 0.096, "CPU": 2, "RAM": 8.0},
    "m5.metal": {"COST": 4.608, "CPU": 96, "RAM": 384.0},
    "m5.xlarge": {"COST": 0.192, "CPU": 4, "RAM": 16.0},
    "m5a.12xlarge": {"COST": 2.064, "CPU": 48, "RAM": 192.0},
    "m5a.16xlarge": {"COST": 2.752, "CPU": 64, "RAM": 256.0},
    "m5a.24xlarge": {"COST": 4.128, "CPU": 96, "RAM": 384.0},
    "m5a.2xlarge": {"COST": 0.344, "CPU": 8, "RAM": 32.0},
    "m5a.4xlarge": {"COST": 0.688, "CPU": 16, "RAM": 64.0},
    "m5a.8xlarge": {"COST": 1.376, "CPU": 32, "RAM": 128.0},
    "m5a.large": {"COST": 0.086, "CPU": 2, "RAM": 8.0},
    "m5a.xlarge": {"COST": 0.172, "CPU": 4, "RAM": 16.0},
    "m5ad.12xlarge": {"COST": 2.472, "CPU": 48, "RAM": 192.0},
    "m5ad.16xlarge": {"COST": 3.296, "CPU": 64, "RAM": 256.0},
    "m5ad.24xlarge": {"COST": 4.944, "CPU": 96, "RAM": 384.0},
    "m5ad.2xlarge": {"COST": 0.412, "CPU": 8, "RAM": 32.0},
    "m5ad.4xlarge": {"COST": 0.824, "CPU": 16, "RAM": 64.0},
    "m5ad.8xlarge": {"COST": 1.648, "CPU": 32, "RAM": 128.0},
    "m5ad.large": {"COST": 0.103, "CPU": 2, "RAM": 8.0},
    "m5ad.xlarge": {"COST": 0.206, "CPU": 4, "RAM": 16.0},
    "m5d.12xlarge": {"COST": 2.712, "CPU": 48, "RAM": 192.0},
    "m5d.16xlarge": {"COST": 3.616, "CPU": 64, "RAM": 256.0},
    "m5d.24xlarge": {"COST": 5.424, "CPU": 96, "RAM": 384.0},
    "m5d.2xlarge": {"COST": 0.452, "CPU": 8, "RAM": 32.0},
    "m5d.4xlarge": {"COST": 0.904, "CPU": 16, "RAM": 64.0},
    "m5d.8xlarge": {"COST": 1.808, "CPU": 32, "RAM": 128.0},
    "m5d.large": {"COST": 0.113, "CPU": 2, "RAM": 8.0},
    "m5d.metal": {"COST": 5.424, "CPU": 96, "RAM": 384.0},
    "m5d.xlarge": {"COST": 0.226, "CPU": 4, "RAM": 16.0},
    "m5dn.12xlarge": {"COST": 3.264, "CPU": 48, "RAM": 192.0},
    "m5dn.16xlarge": {"COST": 4.352, "CPU": 64, "RAM": 256.0},
    "m5dn.24xlarge": {"COST": 6.528, "CPU": 96, "RAM": 384.0},
    "m5dn.2xlarge": {"COST": 0.544, "CPU": 8, "RAM": 32.0},
    "m5dn.4xlarge": {"COST": 1.088, "CPU": 16, "RAM": 64.0},
    "m5dn.8xlarge": {"COST": 2.176, "CPU": 32, "RAM": 128.0},
    "m5dn.large": {"COST": 0.136, "CPU": 2, "RAM": 8.0},
    "m5dn.metal": {"COST": 6.528, "CPU": 96, "RAM": 384.0},
    "m5dn.xlarge": {"COST": 0.272, "CPU": 4, "RAM": 16.0},
    "m5n.12xlarge": {"COST": 2.856, "CPU": 48, "RAM": 192.0},
    "m5n.16xlarge": {"COST": 3.808, "CPU": 64, "RAM": 256.0},
    "m5n.24xlarge": {"COST": 5.712, "CPU": 96, "RAM": 384.0},
    "m5n.2xlarge": {"COST": 0.476, "CPU": 8, "RAM": 32.0},
    "m5n.4xlarge": {"COST": 0.952, "CPU": 16, "RAM": 64.0},
    "m5n.8xlarge": {"COST": 1.904, "CPU": 32, "RAM": 128.0},
    "m5n.large": {"COST": 0.119, "CPU": 2, "RAM": 8.0},
    "m5n.metal": {"COST": 5.712, "CPU": 96, "RAM": 384.0},
    "m5n.xlarge": {"COST": 0.238, "CPU": 4, "RAM": 16.0},
    "m5zn.12xlarge": {"COST": 3.9641, "CPU": 48, "RAM": 192.0},
    "m5zn.2xlarge": {"COST": 0.6607, "CPU": 8, "RAM": 32.0},
    "m5zn.3xlarge": {"COST": 0.991, "CPU": 12, "RAM": 48.0},
    "m5zn.6xlarge": {"COST": 1.982, "CPU": 24, "RAM": 96.0},
    "m5zn.large": {"COST": 0.1652, "CPU": 2, "RAM": 8.0},
    "m5zn.metal": {"COST": 3.9641, "CPU": 48, "RAM": 192.0},
    "m5zn.xlarge": {"COST": 0.3303, "CPU": 4, "RAM": 16.0},
    "m6a.12xlarge": {"COST": 2.0736, "CPU": 48, "RAM": 192.0},
    "m6a.16xlarge": {"COST": 2.7648, "CPU": 64, "RAM": 256.0},
    "m6a.24xlarge": {"COST": 4.1472, "CPU": 96, "RAM": 384.0},
    "m6a.2xlarge": {"COST": 0.3456, "CPU": 8, "RAM": 32.0},
    "m6a.32xlarge": {"COST": 5.5296, "CPU": 128, "RAM": 512.0},
    "m6a.48xlarge": {"COST": 8.2944, "CPU": 192, "RAM": 768.0},
    "m6a.4xlarge": {"COST": 0.6912, "CPU": 16, "RAM": 64.0},
    "m6a.8xlarge": {"COST": 1.3824, "CPU": 32, "RAM": 128.0},
    "m6a.large": {"COST": 0.0864, "CPU": 2, "RAM": 8.0},
    "m6a.metal": {"COST": 8.2944, "CPU": 192, "RAM": 768.0},
    "m6a.xlarge": {"COST": 0.1728, "CPU": 4, "RAM": 16.0},
    "m6g.12xlarge": {"COST": 1.848, "CPU": 48, "RAM": 192.0},
    "m6g.16xlarge": {"COST": 2.464, "CPU": 64, "RAM": 256.0},
    "m6g.2xlarge": {"COST": 0.308, "CPU": 8, "RAM": 32.0},
    "m6g.4xlarge": {"COST": 0.616, "CPU": 16, "RAM": 64.0},
    "m6g.8xlarge": {"COST": 1.232, "CPU": 32, "RAM": 128.0},
    "m6g.large": {"COST": 0.077, "CPU": 2, "RAM": 8.0},
    "m6g.medium": {"COST": 0.0385, "CPU": 1, "RAM": 4.0},
    "m6g.metal": {"COST": 2.464, "CPU": 64, "RAM": 256.0},
    "m6g.xlarge": {"COST": 0.154, "CPU": 4, "RAM": 16.0},
    "m6gd.12xlarge": {"COST": 2.1696, "CPU": 48, "RAM": 192.0},
    "m6gd.16xlarge": {"COST": 2.8928, "CPU": 64, "RAM": 256.0},
    "m6gd.2xlarge": {"COST": 0.3616, "CPU": 8, "RAM": 32.0},
    "m6gd.4xlarge": {"COST": 0.7232, "CPU": 16, "RAM": 64.0},
    "m6gd.8xlarge": {"COST": 1.4464, "CPU": 32, "RAM": 128.0},
    "m6gd.large": {"COST": 0.0904, "CPU": 2, "RAM": 8.0},
    "m6gd.medium": {"COST": 0.0452, "CPU": 1, "RAM": 4.0},
    "m6gd.metal": {"COST": 2.8928, "CPU": 64, "RAM": 256.0},
    "m6gd.xlarge": {"COST": 0.1808, "CPU": 4, "RAM": 16.0},
    "m6i.12xlarge": {"COST": 2.304, "CPU": 48, "RAM": 192.0},
    "m6i.16xlarge": {"COST": 3.072, "CPU": 64, "RAM": 256.0},
    "m6i.24xlarge": {"COST": 4.608, "CPU": 96, "RAM": 384.0},
    "m6i.2xlarge": {"COST": 0.384, "CPU": 8, "RAM": 32.0},
    "m6i.32xlarge": {"COST": 6.144, "CPU": 128, "RAM": 512.0},
    "m6i.4xlarge": {"COST": 0.768, "CPU": 16, "RAM": 64.0},
    "m6i.8xlarge": {"COST": 1.536, "CPU": 32, "RAM": 128.0},
    "m6i.large": {"COST": 0.096, "CPU": 2, "RAM": 8.0},
    "m6i.metal": {"COST": 6.144, "CPU": 128, "RAM": 512.0},
    "m6i.xlarge": {"COST": 0.192, "CPU": 4, "RAM": 16.0},
    "m6id.12xlarge": {"COST": 2.8476, "CPU": 48, "RAM": 192.0},
    "m6id.16xlarge": {"COST": 3.7968, "CPU": 64, "RAM": 256.0},
    "m6id.24xlarge": {"COST": 5.6952, "CPU": 96, "RAM": 384.0},
    "m6id.2xlarge": {"COST": 0.4746, "CPU": 8, "RAM": 32.0},
    "m6id.32xlarge": {"COST": 7.5936, "CPU": 128, "RAM": 512.0},
    "m6id.4xlarge": {"COST": 0.9492, "CPU": 16, "RAM": 64.0},
    "m6id.8xlarge": {"COST": 1.8984, "CPU": 32, "RAM": 128.0},
    "m6id.large": {"COST": 0.1187, "CPU": 2, "RAM": 8.0},
    "m6id.metal": {"COST": 7.5936, "CPU": 128, "RAM": 512.0},
    "m6id.xlarge": {"COST": 0.2373, "CPU": 4, "RAM": 16.0},
    "m6idn.12xlarge": {"COST": 3.8189, "CPU": 48, "RAM": 192.0},
    "m6idn.16xlarge": {"COST": 5.0918, "CPU": 64, "RAM": 256.0},
    "m6idn.24xlarge": {"COST": 7.6378, "CPU": 96, "RAM": 384.0},
    "m6idn.2xlarge": {"COST": 0.6365, "CPU": 8, "RAM": 32.0},
    "m6idn.32xlarge": {"COST": 10.1837, "CPU": 128, "RAM": 512.0},
    "m6idn.4xlarge": {"COST": 1.273, "CPU": 16, "RAM": 64.0},
    "m6idn.8xlarge": {"COST": 2.5459, "CPU": 32, "RAM": 128.0},
    "m6idn.large": {"COST": 0.1591, "CPU": 2, "RAM": 8.0},
    "m6idn.metal": {"COST": 10.1837, "CPU": 128, "RAM": 512.0},
    "m6idn.xlarge": {"COST": 0.3182, "CPU": 4, "RAM": 16.0},
    "m6in.12xlarge": {"COST": 3.3415, "CPU": 48, "RAM": 192.0},
    "m6in.16xlarge": {"COST": 4.4554, "CPU": 64, "RAM": 256.0},
    "m6in.24xlarge": {"COST": 6.683, "CPU": 96, "RAM": 384.0},
    "m6in.2xlarge": {"COST": 0.5569, "CPU": 8, "RAM": 32.0},
    "m6in.32xlarge": {"COST": 8.9107, "CPU": 128, "RAM": 512.0},
    "m6in.4xlarge": {"COST": 1.1138, "CPU": 16, "RAM": 64.0},
    "m6in.8xlarge": {"COST": 2.2277, "CPU": 32, "RAM": 128.0},
    "m6in.large": {"COST": 0.1392, "CPU": 2, "RAM": 8.0},
    "m6in.metal": {"COST": 8.9107, "CPU": 128, "RAM": 512.0},
    "m6in.xlarge": {"COST": 0.2785, "CPU": 4, "RAM": 16.0},
    "m7a.12xlarge": {"COST": 2.7821, "CPU": 48, "RAM": 192.0},
    "m7a.16xlarge": {"COST": 3.7094, "CPU": 64, "RAM": 256.0},
    "m7a.24xlarge": {"COST": 5.5642, "CPU": 96, "RAM": 384.0},
    "m7a.2xlarge": {"COST": 0.4637, "CPU": 8, "RAM": 32.0},
    "m7a.32xlarge": {"COST": 7.4189, "CPU": 128, "RAM": 512.0},
    "m7a.48xlarge": {"COST": 11.1283, "CPU": 192, "RAM": 768.0},
    "m7a.4xlarge": {"COST": 0.9274, "CPU": 16, "RAM": 64.0},
    "m7a.8xlarge": {"COST": 1.8547, "CPU": 32, "RAM": 128.0},
    "m7a.large": {"COST": 0.1159, "CPU": 2, "RAM": 8.0},
    "m7a.medium": {"COST": 0.058, "CPU": 1, "RAM": 4.0},
    "m7a.metal-48xl": {"COST": 11.1283, "CPU": 192, "RAM": 768.0},
    "m7a.xlarge": {"COST": 0.2318, "CPU": 4, "RAM": 16.0},
    "m7g.12xlarge": {"COST": 1.9584, "CPU": 48, "RAM": 192.0},
    "m7g.16xlarge": {"COST": 2.6112, "CPU": 64, "RAM": 256.0},
    "m7g.2xlarge": {"COST": 0.3264, "CPU": 8, "RAM": 32.0},
    "m7g.4xlarge": {"COST": 0.6528, "CPU": 16, "RAM": 64.0},
    "m7g.8xlarge": {"COST": 1.3056, "CPU": 32, "RAM": 128.0},
    "m7g.large": {"COST": 0.0816, "CPU": 2, "RAM": 8.0},
    "m7g.medium": {"COST": 0.0408, "CPU": 1, "RAM": 4.0},
    "m7g.metal": {"COST": 2.6112, "CPU": 64, "RAM": 256.0},
    "m7g.xlarge": {"COST": 0.1632, "CPU": 4, "RAM": 16.0},
    "m7gd.12xlarge": {"COST": 2.5628, "CPU": 48, "RAM": 192.0},
    "m7gd.16xlarge": {"COST": 3.4171, "CPU": 64, "RAM": 256.0},
    "m7gd.2xlarge": {"COST": 0.4271, "CPU": 8, "RAM": 32.0},
    "m7gd.4xlarge": {"COST": 0.8543, "CPU": 16, "RAM": 64.0},
    "m7gd.8xlarge": {"COST": 1.7086, "CPU": 32, "RAM": 128.0},
    "m7gd.large": {"COST": 0.1068, "CPU": 2, "RAM": 8.0},
    "m7gd.medium": {"COST": 0.0534, "CPU": 1, "RAM": 4.0},
    "m7gd.xlarge": {"COST": 0.2136, "CPU": 4, "RAM": 16.0},
    "m7i-flex.2xlarge": {"COST": 0.383, "CPU": 8, "RAM": 32.0},
    "m7i-flex.4xlarge": {"COST": 0.7661, "CPU": 16, "RAM": 64.0},
    "m7i-flex.8xlarge": {"COST": 1.5322, "CPU": 32, "RAM": 128.0},
    "m7i-flex.large": {"COST": 0.0958, "CPU": 2, "RAM": 8.0},
    "m7i-flex.xlarge": {"COST": 0.1915, "CPU": 4, "RAM": 16.0},
    "m7i.12xlarge": {"COST": 2.4192, "CPU": 48, "RAM": 192.0},
    "m7i.16xlarge": {"COST": 3.2256, "CPU": 64, "RAM": 256.0},
    "m7i.24xlarge": {"COST": 4.8384, "CPU": 96, "RAM": 384.0},
    "m7i.2xlarge": {"COST": 0.4032, "CPU": 8, "RAM": 32.0},
    "m7i.48xlarge": {"COST": 9.6768, "CPU": 192, "RAM": 768.0},
    "m7i.4xlarge": {"COST": 0.8064, "CPU": 16, "RAM": 64.0},
    "m7i.8xlarge": {"COST": 1.6128, "CPU": 32, "RAM": 128.0},
    "m7i.large": {"COST": 0.1008, "CPU": 2, "RAM": 8.0},
    "m7i.xlarge": {"COST": 0.2016, "CPU": 4, "RAM": 16.0},
    "p2.16xlarge": {"COST": 14.4, "CPU": 64, "RAM": 732.0},
    "p2.8xlarge": {"COST": 7.2, "CPU": 32, "RAM": 488.0},
    "p2.xlarge": {"COST": 0.9, "CPU": 4, "RAM": 61.0},
    "p3.16xlarge": {"COST": 24.48, "CPU": 64, "RAM": 488.0},
    "p3.2xlarge": {"COST": 3.06, "CPU": 8, "RAM": 61.0},
    "p3.8xlarge": {"COST": 12.24, "CPU": 32, "RAM": 244.0},
    "p3dn.24xlarge": {"COST": 31.212, "CPU": 96, "RAM": 768.0},
    "p4d.24xlarge": {"COST": 32.7726, "CPU": 96, "RAM": 1152.0},
    "p4de.24xlarge": {"COST": 40.9657, "CPU": 96, "RAM": 1152.0},
    "p5.48xlarge": {"COST": 98.32, "CPU": 192, "RAM": 2048.0},
    "r3.2xlarge": {"COST": 0.665, "CPU": 8, "RAM": 61.0},
    "r3.4xlarge": {"COST": 1.33, "CPU": 16, "RAM": 122.0},
    "r3.8xlarge": {"COST": 2.66, "CPU": 32, "RAM": 244.0},
    "r3.large": {"COST": 0.166, "CPU": 2, "RAM": 15.25},
    "r3.xlarge": {"COST": 0.333, "CPU": 4, "RAM": 30.5},
    "r4.16xlarge": {"COST": 4.256, "CPU": 64, "RAM": 488.0},
    "r4.2xlarge": {"COST": 0.532, "CPU": 8, "RAM": 61.0},
    "r4.4xlarge": {"COST": 1.064, "CPU": 16, "RAM": 122.0},
    "r4.8xlarge": {"COST": 2.128, "CPU": 32, "RAM": 244.0},
    "r4.large": {"COST": 0.133, "CPU": 2, "RAM": 15.25},
    "r4.xlarge": {"COST": 0.266, "CPU": 4, "RAM": 30.5},
    "r5.12xlarge": {"COST": 3.024, "CPU": 48, "RAM": 384.0},
    "r5.16xlarge": {"COST": 4.032, "CPU": 64, "RAM": 512.0},
    "r5.24xlarge": {"COST": 6.048, "CPU": 96, "RAM": 768.0},
    "r5.2xlarge": {"COST": 0.504, "CPU": 8, "RAM": 64.0},
    "r5.4xlarge": {"COST": 1.008, "CPU": 16, "RAM": 128.0},
    "r5.8xlarge": {"COST": 2.016, "CPU": 32, "RAM": 256.0},
    "r5.large": {"COST": 0.126, "CPU": 2, "RAM": 16.0},
    "r5.metal": {"COST": 6.048, "CPU": 96, "RAM": 768.0},
    "r5.xlarge": {"COST": 0.252, "CPU": 4, "RAM": 32.0},
    "r5a.12xlarge": {"COST": 2.712, "CPU": 48, "RAM": 384.0},
    "r5a.16xlarge": {"COST": 3.616, "CPU": 64, "RAM": 512.0},
    "r5a.24xlarge": {"COST": 5.424, "CPU": 96, "RAM": 768.0},
    "r5a.2xlarge": {"COST": 0.452, "CPU": 8, "RAM": 64.0},
    "r5a.4xlarge": {"COST": 0.904, "CPU": 16, "RAM": 128.0},
    "r5a.8xlarge": {"COST": 1.808, "CPU": 32, "RAM": 256.0},
    "r5a.large": {"COST": 0.113, "CPU": 2, "RAM": 16.0},
    "r5a.xlarge": {"COST": 0.226, "CPU": 4, "RAM": 32.0},
    "r5ad.12xlarge": {"COST": 3.144, "CPU": 48, "RAM": 384.0},
    "r5ad.16xlarge": {"COST": 4.192, "CPU": 64, "RAM": 512.0},
    "r5ad.24xlarge": {"COST": 6.288, "CPU": 96, "RAM": 768.0},
    "r5ad.2xlarge": {"COST": 0.524, "CPU": 8, "RAM": 64.0},
    "r5ad.4xlarge": {"COST": 1.048, "CPU": 16, "RAM": 128.0},
    "r5ad.8xlarge": {"COST": 2.096, "CPU": 32, "RAM": 256.0},
    "r5ad.large": {"COST": 0.131, "CPU": 2, "RAM": 16.0},
    "r5ad.xlarge": {"COST": 0.262, "CPU": 4, "RAM": 32.0},
    "r5b.12xlarge": {"COST": 3.576, "CPU": 48, "RAM": 384.0},
    "r5b.16xlarge": {"COST": 4.768, "CPU": 64, "RAM": 512.0},
    "r5b.24xlarge": {"COST": 7.152, "CPU": 96, "RAM": 768.0},
    "r5b.2xlarge": {"COST": 0.596, "CPU": 8, "RAM": 64.0},
    "r5b.4xlarge": {"COST": 1.192, "CPU": 16, "RAM": 128.0},
    "r5b.8xlarge": {"COST": 2.384, "CPU": 32, "RAM": 256.0},
    "r5b.large": {"COST": 0.149, "CPU": 2, "RAM": 16.0},
    "r5b.metal": {"COST": 7.152, "CPU": 96, "RAM": 768.0},
    "r5b.xlarge": {"COST": 0.298, "CPU": 4, "RAM": 32.0},
    "r5d.12xlarge": {"COST": 3.456, "CPU": 48, "RAM": 384.0},
    "r5d.16xlarge": {"COST": 4.608, "CPU": 64, "RAM": 512.0},
    "r5d.24xlarge": {"COST": 6.912, "CPU": 96, "RAM": 768.0},
    "r5d.2xlarge": {"COST": 0.576, "CPU": 8, "RAM": 64.0},
    "r5d.4xlarge": {"COST": 1.152, "CPU": 16, "RAM": 128.0},
    "r5d.8xlarge": {"COST": 2.304, "CPU": 32, "RAM": 256.0},
    "r5d.large": {"COST": 0.144, "CPU": 2, "RAM": 16.0},
    "r5d.metal": {"COST": 6.912, "CPU": 96, "RAM": 768.0},
    "r5d.xlarge": {"COST": 0.288, "CPU": 4, "RAM": 32.0},
    "r5dn.12xlarge": {"COST": 4.008, "CPU": 48, "RAM": 384.0},
    "r5dn.16xlarge": {"COST": 5.344, "CPU": 64, "RAM": 512.0},
    "r5dn.24xlarge": {"COST": 8.016, "CPU": 96, "RAM": 768.0},
    "r5dn.2xlarge": {"COST": 0.668, "CPU": 8, "RAM": 64.0},
    "r5dn.4xlarge": {"COST": 1.336, "CPU": 16, "RAM": 128.0},
    "r5dn.8xlarge": {"COST": 2.672, "CPU": 32, "RAM": 256.0},
    "r5dn.large": {"COST": 0.167, "CPU": 2, "RAM": 16.0},
    "r5dn.metal": {"COST": 8.016, "CPU": 96, "RAM": 768.0},
    "r5dn.xlarge": {"COST": 0.334, "CPU": 4, "RAM": 32.0},
    "r5n.12xlarge": {"COST": 3.576, "CPU": 48, "RAM": 384.0},
    "r5n.16xlarge": {"COST": 4.768, "CPU": 64, "RAM": 512.0},
    "r5n.24xlarge": {"COST": 7.152, "CPU": 96, "RAM": 768.0},
    "r5n.2xlarge": {"COST": 0.596, "CPU": 8, "RAM": 64.0},
    "r5n.4xlarge": {"COST": 1.192, "CPU": 16, "RAM": 128.0},
    "r5n.8xlarge": {"COST": 2.384, "CPU": 32, "RAM": 256.0},
    "r5n.large": {"COST": 0.149, "CPU": 2, "RAM": 16.0},
    "r5n.metal": {"COST": 7.152, "CPU": 96, "RAM": 768.0},
    "r5n.xlarge": {"COST": 0.298, "CPU": 4, "RAM": 32.0},
    "r6a.12xlarge": {"COST": 2.7216, "CPU": 48, "RAM": 384.0},
    "r6a.16xlarge": {"COST": 3.6288, "CPU": 64, "RAM": 512.0},
    "r6a.24xlarge": {"COST": 5.4432, "CPU": 96, "RAM": 768.0},
    "r6a.2xlarge": {"COST": 0.4536, "CPU": 8, "RAM": 64.0},
    "r6a.32xlarge": {"COST": 7.2576, "CPU": 128, "RAM": 1024.0},
    "r6a.48xlarge": {"COST": 10.8864, "CPU": 192, "RAM": 1536.0},
    "r6a.4xlarge": {"COST": 0.9072, "CPU": 16, "RAM": 128.0},
    "r6a.8xlarge": {"COST": 1.8144, "CPU": 32, "RAM": 256.0},
    "r6a.large": {"COST": 0.1134, "CPU": 2, "RAM": 16.0},
    "r6a.metal": {"COST": 10.8864, "CPU": 192, "RAM": 1536.0},
    "r6a.xlarge": {"COST": 0.2268, "CPU": 4, "RAM": 32.0},
    "r6g.12xlarge": {"COST": 2.4192, "CPU": 48, "RAM": 384.0},
    "r6g.16xlarge": {"COST": 3.2256, "CPU": 64, "RAM": 512.0},
    "r6g.2xlarge": {"COST": 0.4032, "CPU": 8, "RAM": 64.0},
    "r6g.4xlarge": {"COST": 0.8064, "CPU": 16, "RAM": 128.0},
    "r6g.8xlarge": {"COST": 1.6128, "CPU": 32, "RAM": 256.0},
    "r6g.large": {"COST": 0.1008, "CPU": 2, "RAM": 16.0},
    "r6g.medium": {"COST": 0.0504, "CPU": 1, "RAM": 8.0},
    "r6g.metal": {"COST": 3.2256, "CPU": 64, "RAM": 512.0},
    "r6g.xlarge": {"COST": 0.2016, "CPU": 4, "RAM": 32.0},
    "r6gd.12xlarge": {"COST": 2.7648, "CPU": 48, "RAM": 384.0},
    "r6gd.16xlarge": {"COST": 3.6864, "CPU": 64, "RAM": 512.0},
    "r6gd.2xlarge": {"COST": 0.4608, "CPU": 8, "RAM": 64.0},
    "r6gd.4xlarge": {"COST": 0.9216, "CPU": 16, "RAM": 128.0},
    "r6gd.8xlarge": {"COST": 1.8432, "CPU": 32, "RAM": 256.0},
    "r6gd.large": {"COST": 0.1152, "CPU": 2, "RAM": 16.0},
    "r6gd.medium": {"COST": 0.0576, "CPU": 1, "RAM": 8.0},
    "r6gd.metal": {"COST": 3.6864, "CPU": 64, "RAM": 512.0},
    "r6gd.xlarge": {"COST": 0.2304, "CPU": 4, "RAM": 32.0},
    "r6i.12xlarge": {"COST": 3.024, "CPU": 48, "RAM": 384.0},
    "r6i.16xlarge": {"COST": 4.032, "CPU": 64, "RAM": 512.0},
    "r6i.24xlarge": {"COST": 6.048, "CPU": 96, "RAM": 768.0},
    "r6i.2xlarge": {"COST": 0.504, "CPU": 8, "RAM": 64.0},
    "r6i.32xlarge": {"COST": 8.064, "CPU": 128, "RAM": 1024.0},
    "r6i.4xlarge": {"COST": 1.008, "CPU": 16, "RAM": 128.0},
    "r6i.8xlarge": {"COST": 2.016, "CPU": 32, "RAM": 256.0},
    "r6i.large": {"COST": 0.126, "CPU": 2, "RAM": 16.0},
    "r6i.metal": {"COST": 8.064, "CPU": 128, "RAM": 1024.0},
    "r6i.xlarge": {"COST": 0.252, "CPU": 4, "RAM": 32.0},
    "r6id.12xlarge": {"COST": 3.6288, "CPU": 48, "RAM": 384.0},
    "r6id.16xlarge": {"COST": 4.8384, "CPU": 64, "RAM": 512.0},
    "r6id.24xlarge": {"COST": 7.2576, "CPU": 96, "RAM": 768.0},
    "r6id.2xlarge": {"COST": 0.6048, "CPU": 8, "RAM": 64.0},
    "r6id.32xlarge": {"COST": 9.6768, "CPU": 128, "RAM": 1024.0},
    "r6id.4xlarge": {"COST": 1.2096, "CPU": 16, "RAM": 128.0},
    "r6id.8xlarge": {"COST": 2.4192, "CPU": 32, "RAM": 256.0},
    "r6id.large": {"COST": 0.1512, "CPU": 2, "RAM": 16.0},
    "r6id.metal": {"COST": 9.6768, "CPU": 128, "RAM": 1024.0},
    "r6id.xlarge": {"COST": 0.3024, "CPU": 4, "RAM": 32.0},
    "r6idn.12xlarge": {"COST": 4.6894, "CPU": 48, "RAM": 384.0},
    "r6idn.16xlarge": {"COST": 6.2525, "CPU": 64, "RAM": 512.0},
    "r6idn.24xlarge": {"COST": 9.3787, "CPU": 96, "RAM": 768.0},
    "r6idn.2xlarge": {"COST": 0.7816, "CPU": 8, "RAM": 64.0},
    "r6idn.32xlarge": {"COST": 12.505, "CPU": 128, "RAM": 1024.0},
    "r6idn.4xlarge": {"COST": 1.5631, "CPU": 16, "RAM": 128.0},
    "r6idn.8xlarge": {"COST": 3.1262, "CPU": 32, "RAM": 256.0},
    "r6idn.large": {"COST": 0.1954, "CPU": 2, "RAM": 16.0},
    "r6idn.metal": {"COST": 12.505, "CPU": 128, "RAM": 1024.0},
    "r6idn.xlarge": {"COST": 0.3908, "CPU": 4, "RAM": 32.0},
    "r6in.12xlarge": {"COST": 4.1839, "CPU": 48, "RAM": 384.0},
    "r6in.16xlarge": {"COST": 5.5786, "CPU": 64, "RAM": 512.0},
    "r6in.24xlarge": {"COST": 8.3678, "CPU": 96, "RAM": 768.0},
    "r6in.2xlarge": {"COST": 0.6973, "CPU": 8, "RAM": 64.0},
    "r6in.32xlarge": {"COST": 11.1571, "CPU": 128, "RAM": 1024.0},
    "r6in.4xlarge": {"COST": 1.3946, "CPU": 16, "RAM": 128.0},
    "r6in.8xlarge": {"COST": 2.7893, "CPU": 32, "RAM": 256.0},
    "r6in.large": {"COST": 0.1743, "CPU": 2, "RAM": 16.0},
    "r6in.metal": {"COST": 11.1571, "CPU": 128, "RAM": 1024.0},
    "r6in.xlarge": {"COST": 0.3487, "CPU": 4, "RAM": 32.0},
    "r7g.12xlarge": {"COST": 2.5704, "CPU": 48, "RAM": 384.0},
    "r7g.16xlarge": {"COST": 3.4272, "CPU": 64, "RAM": 512.0},
    "r7g.2xlarge": {"COST": 0.4284, "CPU": 8, "RAM": 64.0},
    "r7g.4xlarge": {"COST": 0.8568, "CPU": 16, "RAM": 128.0},
    "r7g.8xlarge": {"COST": 1.7136, "CPU": 32, "RAM": 256.0},
    "r7g.large": {"COST": 0.1071, "CPU": 2, "RAM": 16.0},
    "r7g.medium": {"COST": 0.0536, "CPU": 1, "RAM": 8.0},
    "r7g.metal": {"COST": 3.4272, "CPU": 64, "RAM": 512.0},
    "r7g.xlarge": {"COST": 0.2142, "CPU": 4, "RAM": 32.0},
    "r7gd.12xlarge": {"COST": 3.2659, "CPU": 48, "RAM": 384.0},
    "r7gd.16xlarge": {"COST": 4.3546, "CPU": 64, "RAM": 512.0},
    "r7gd.2xlarge": {"COST": 0.5443, "CPU": 8, "RAM": 64.0},
    "r7gd.4xlarge": {"COST": 1.0886, "CPU": 16, "RAM": 128.0},
    "r7gd.8xlarge": {"COST": 2.1773, "CPU": 32, "RAM": 256.0},
    "r7gd.large": {"COST": 0.1361, "CPU": 2, "RAM": 16.0},
    "r7gd.medium": {"COST": 0.068, "CPU": 1, "RAM": 8.0},
    "r7gd.xlarge": {"COST": 0.2722, "CPU": 4, "RAM": 32.0},
    "r7iz.12xlarge": {"COST": 4.464, "CPU": 48, "RAM": 384.0},
    "r7iz.16xlarge": {"COST": 5.952, "CPU": 64, "RAM": 512.0},
    "r7iz.2xlarge": {"COST": 0.744, "CPU": 8, "RAM": 64.0},
    "r7iz.32xlarge": {"COST": 11.904, "CPU": 128, "RAM": 1024.0},
    "r7iz.4xlarge": {"COST": 1.488, "CPU": 16, "RAM": 128.0},
    "r7iz.8xlarge": {"COST": 2.976, "CPU": 32, "RAM": 256.0},
    "r7iz.large": {"COST": 0.186, "CPU": 2, "RAM": 16.0},
    "r7iz.xlarge": {"COST": 0.372, "CPU": 4, "RAM": 32.0},
    "t1.micro": {"COST": 0.02, "CPU": 1, "RAM": 0.613},
    "t2.2xlarge": {"COST": 0.3712, "CPU": 8, "RAM": 32.0},
    "t2.large": {"COST": 0.0928, "CPU": 2, "RAM": 8.0},
    "t2.medium": {"COST": 0.0464, "CPU": 2, "RAM": 4.0},
    "t2.micro": {"COST": 0.0116, "CPU": 1, "RAM": 1.0},
    "t2.nano": {"COST": 0.0058, "CPU": 1, "RAM": 0.5},
    "t2.small": {"COST": 0.023, "CPU": 1, "RAM": 2.0},
    "t2.xlarge": {"COST": 0.1856, "CPU": 4, "RAM": 16.0},
    "t3.2xlarge": {"COST": 0.3328, "CPU": 8, "RAM": 32.0},
    "t3.large": {"COST": 0.0832, "CPU": 2, "RAM": 8.0},
    "t3.medium": {"COST": 0.0416, "CPU": 2, "RAM": 4.0},
    "t3.micro": {"COST": 0.0104, "CPU": 2, "RAM": 1.0},
    "t3.nano": {"COST": 0.0052, "CPU": 2, "RAM": 0.5},
    "t3.small": {"COST": 0.0208, "CPU": 2, "RAM": 2.0},
    "t3.xlarge": {"COST": 0.1664, "CPU": 4, "RAM": 16.0},
    "t3a.2xlarge": {"COST": 0.3008, "CPU": 8, "RAM": 32.0},
    "t3a.large": {"COST": 0.0752, "CPU": 2, "RAM": 8.0},
    "t3a.medium": {"COST": 0.0376, "CPU": 2, "RAM": 4.0},
    "t3a.micro": {"COST": 0.0094, "CPU": 2, "RAM": 1.0},
    "t3a.nano": {"COST": 0.0047, "CPU": 2, "RAM": 0.5},
    "t3a.small": {"COST": 0.0188, "CPU": 2, "RAM": 2.0},
    "t3a.xlarge": {"COST": 0.1504, "CPU": 4, "RAM": 16.0},
    "t4g.2xlarge": {"COST": 0.2688, "CPU": 8, "RAM": 32.0},
    "t4g.large": {"COST": 0.0672, "CPU": 2, "RAM": 8.0},
    "t4g.medium": {"COST": 0.0336, "CPU": 2, "RAM": 4.0},
    "t4g.micro": {"COST": 0.0084, "CPU": 2, "RAM": 1.0},
    "t4g.nano": {"COST": 0.0042, "CPU": 2, "RAM": 0.5},
    "t4g.small": {"COST": 0.0168, "CPU": 2, "RAM": 2.0},
    "t4g.xlarge": {"COST": 0.1344, "CPU": 4, "RAM": 16.0},
    "trn1.2xlarge": {"COST": 1.3438, "CPU": 8, "RAM": 32.0},
    "trn1.32xlarge": {"COST": 21.5, "CPU": 128, "RAM": 512.0},
    "trn1n.32xlarge": {"COST": 24.78, "CPU": 128, "RAM": 512.0},
    "u-12tb1.112xlarge": {"COST": 109.2, "CPU": 448, "RAM": 12288.0},
    "u-18tb1.112xlarge": {"COST": 163.8, "CPU": 448, "RAM": 18432.0},
    "u-24tb1.112xlarge": {"COST": 218.4, "CPU": 448, "RAM": 24576.0},
    "u-3tb1.56xlarge": {"COST": 27.3, "CPU": 224, "RAM": 3072.0},
    "u-6tb1.112xlarge": {"COST": 54.6, "CPU": 448, "RAM": 6144.0},
    "u-6tb1.56xlarge": {"COST": 46.4039, "CPU": 224, "RAM": 6144.0},
    "u-9tb1.112xlarge": {"COST": 81.9, "CPU": 448, "RAM": 9216.0},
    "vt1.24xlarge": {"COST": 5.2, "CPU": 96, "RAM": 192.0},
    "vt1.3xlarge": {"COST": 0.65, "CPU": 12, "RAM": 24.0},
    "vt1.6xlarge": {"COST": 1.3, "CPU": 24, "RAM": 48.0},
    "x1.16xlarge": {"COST": 6.669, "CPU": 64, "RAM": 976.0},
    "x1.32xlarge": {"COST": 13.338, "CPU": 128, "RAM": 1952.0},
    "x1e.16xlarge": {"COST": 13.344, "CPU": 64, "RAM": 1952.0},
    "x1e.2xlarge": {"COST": 1.668, "CPU": 8, "RAM": 244.0},
    "x1e.32xlarge": {"COST": 26.688, "CPU": 128, "RAM": 3904.0},
    "x1e.4xlarge": {"COST": 3.336, "CPU": 16, "RAM": 488.0},
    "x1e.8xlarge": {"COST": 6.672, "CPU": 32, "RAM": 976.0},
    "x1e.xlarge": {"COST": 0.834, "CPU": 4, "RAM": 122.0},
    "x2gd.12xlarge": {"COST": 4.008, "CPU": 48, "RAM": 768.0},
    "x2gd.16xlarge": {"COST": 5.344, "CPU": 64, "RAM": 1024.0},
    "x2gd.2xlarge": {"COST": 0.668, "CPU": 8, "RAM": 128.0},
    "x2gd.4xlarge": {"COST": 1.336, "CPU": 16, "RAM": 256.0},
    "x2gd.8xlarge": {"COST": 2.672, "CPU": 32, "RAM": 512.0},
    "x2gd.large": {"COST": 0.167, "CPU": 2, "RAM": 32.0},
    "x2gd.medium": {"COST": 0.0835, "CPU": 1, "RAM": 16.0},
    "x2gd.metal": {"COST": 5.344, "CPU": 64, "RAM": 1024.0},
    "x2gd.xlarge": {"COST": 0.334, "CPU": 4, "RAM": 64.0},
    "x2idn.16xlarge": {"COST": 6.669, "CPU": 64, "RAM": 1024.0},
    "x2idn.24xlarge": {"COST": 10.0035, "CPU": 96, "RAM": 1536.0},
    "x2idn.32xlarge": {"COST": 13.338, "CPU": 128, "RAM": 2048.0},
    "x2idn.metal": {"COST": 13.338, "CPU": 128, "RAM": 2048.0},
    "x2iedn.16xlarge": {"COST": 13.338, "CPU": 64, "RAM": 2048.0},
    "x2iedn.24xlarge": {"COST": 20.007, "CPU": 96, "RAM": 3072.0},
    "x2iedn.2xlarge": {"COST": 1.6672, "CPU": 8, "RAM": 256.0},
    "x2iedn.32xlarge": {"COST": 26.676, "CPU": 128, "RAM": 4096.0},
    "x2iedn.4xlarge": {"COST": 3.3345, "CPU": 16, "RAM": 512.0},
    "x2iedn.8xlarge": {"COST": 6.669, "CPU": 32, "RAM": 1024.0},
    "x2iedn.metal": {"COST": 26.676, "CPU": 128, "RAM": 4096.0},
    "x2iedn.xlarge": {"COST": 0.8336, "CPU": 4, "RAM": 128.0},
    "x2iezn.12xlarge": {"COST": 10.008, "CPU": 48, "RAM": 1536.0},
    "x2iezn.2xlarge": {"COST": 1.668, "CPU": 8, "RAM": 256.0},
    "x2iezn.4xlarge": {"COST": 3.336, "CPU": 16, "RAM": 512.0},
    "x2iezn.6xlarge": {"COST": 5.004, "CPU": 24, "RAM": 768.0},
    "x2iezn.8xlarge": {"COST": 6.672, "CPU": 32, "RAM": 1024.0},
    "x2iezn.metal": {"COST": 10.008, "CPU": 48, "RAM": 1536.0},
    "z1d.12xlarge": {"COST": 4.464, "CPU": 48, "RAM": 384.0},
    "z1d.2xlarge": {"COST": 0.744, "CPU": 8, "RAM": 64.0},
    "z1d.3xlarge": {"COST": 1.116, "CPU": 12, "RAM": 96.0},
    "z1d.6xlarge": {"COST": 2.232, "CPU": 24, "RAM": 192.0},
    "z1d.large": {"COST": 0.186, "CPU": 2, "RAM": 16.0},
    "z1d.metal": {"COST": 4.464, "CPU": 48, "RAM": 384.0},
    "z1d.xlarge": {"COST": 0.372, "CPU": 4, "RAM": 32.0},
}


def computeIsGpu(instanceType):
    prefix = instanceType.split(".")[0]

    return prefix in ["p3", "p2", "g5", "g3", "f1"]


instance_types_to_show = set(
    [
        x
        for x in valid_instance_types
        if ("xlarge" in x and ".xlarge" not in x)
        and x.split(".")[0] in ["m4", "m5", "m6i", "c4", "c5", "r4", "r5", "i3", "g5", "x1"]
    ]
)


def instanceTagValue(instance, tag):
    """Given an instance dict (from boto, see comment on 'allRunningInstances'), what's the
    value of tag 'tag', or None if not provided."""
    for tagDict in instance["Tags"]:
        if tagDict["Key"] == tag:
            return tagDict["Value"]
    return None


BootConfig = NamedTuple(docker_image=str, ami=str)


@schema.define
class Configuration:
    db_hostname = str  # hostname to connect back to
    db_port = int  # port to connect back to
    region = str  # region to boot into
    vpc_id = str  # id of vpc to boot into
    default_subnet = str  # id of subnet to boot into
    security_group = str  # id of security group to boot into
    keypair = str  # security keypair name to use
    worker_name = str  # name of workers. This should be unique to this install.
    worker_iam_role_name = str  # AIM role to boot workers into
    defaultStorageSize = int  # gb of disk to mount on booted workers (if they need ebs)
    max_to_boot = int  # maximum number of workers we'll boot
    available_subnets = ConstDict(str, str)  # supported subnet -> availability zone

    cpu_boot_config = BootConfig
    gpu_boot_config = OneOf(None, BootConfig)

    bootstrap_script_override = OneOf(None, str)  # the bootstrap script to use


@schema.define
class DynamicConfiguration:
    """Override the fields of the Configuration.
    This can be toggled and the service is expected to respond.
    Contrast with Configuration which is supposed to be static (if you want to
    change it you have to reboot the service).
    """

    subnet_override = OneOf(None, str)

    @staticmethod
    def getOrCreate():
        return DynamicConfiguration.lookupAny() or DynamicConfiguration()

    @staticmethod
    def setSubnet(subnet: str):
        dc = DynamicConfiguration.lookupAny()

        if subnet == Configuration.lookupOne().default_subnet:
            if dc is not None and dc.subnet_override is not None:
                dc.subnet_override = None
        else:
            if dc is None:
                dc = DynamicConfiguration()
                dc.subnet_override = subnet
            elif dc.subnet_override != subnet:
                dc.subnet_override = subnet

    @staticmethod
    def currentSubnet():
        dc = DynamicConfiguration.lookupAny()

        if dc is None or dc.subnet_override is None:
            return Configuration.lookupOne().default_subnet
        else:
            return dc.subnet_override


@schema.define
class State:
    instance_type = Indexed(str)
    placementGroup = str

    instance_type_and_pg = Index("instance_type", "placementGroup")

    booted = int
    desired = int
    spot_desired = int
    spot_booted = int
    observedLimit = OneOf(None, int)  # maximum observed limit count
    capacityConstrained = bool
    spotPrices = ConstDict(str, float)

    storageSizeOverride = OneOf(None, int)


@schema.define
class RunningInstance:
    instanceId = Indexed(str)
    isSpot = bool
    instance_type = str
    placementGroup = str
    hostname = str
    state = OneOf("running", "pending")
    subnet = str
    availability_zone = str


ownDir = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(ownDir, "aws_linux_bootstrap.sh"), "r") as fh:
    linux_bootstrap_script = fh.read()


class AwsApi:
    def __init__(self):
        self._logger = logging.getLogger(__name__)

        self.config = Configuration.lookupAny()
        if not self.config:
            raise Exception("Please configure the aws service.")

        self.ec2 = boto3.resource("ec2", region_name=self.config.region)
        self.ec2_client = boto3.client("ec2", region_name=self.config.region)
        self.s3 = boto3.resource("s3", region_name=self.config.region)
        self.s3_client = boto3.client("s3", region_name=self.config.region)

    def allRunningInstances(self, includePending=True, spot=False):
        """Get a list of all running instances.

        Returns:
            a dict from instanceId -> instance, where an 'instance' looks something like



            { 'AmiLaunchIndex': 0,
              'Architecture': 'x86_64',
              'BlockDeviceMappings': [ { 'DeviceName': '/dev/sda1',
                                         'Ebs': { 'AttachTime': datetime.datetime(...),
                                                  'DeleteOnTermination': True,
                                                  'Status': 'attached',
                                                  'VolumeId': 'vol-XXX'}},
                                       { 'DeviceName': '/dev/xvdb',
                                         'Ebs': { 'AttachTime': datetime.datetime(...),
                                                  'DeleteOnTermination': True,
                                                  'Status': 'attached',
                                                  'VolumeId': 'vol-XXX'}}],
              'CapacityReservationSpecification': {'CapacityReservationPreference': 'open'},
              'ClientToken': '...',
              'CpuOptions': {'CoreCount': 32, 'ThreadsPerCore': 2},
              'EbsOptimized': False,
              'EnaSupport': True,
              'HibernationOptions': {'Configured': False},
              'Hypervisor': 'xen',
              'IamInstanceProfile': { 'Arn': 'arn:aws:iam::...:instance-profile/...,
                                      'Id': '...'},
              'ImageId': 'ami-XXX',
              'InstanceId': 'i-XXX',
              'InstanceLifecycle': 'spot',
              'InstanceType': 'r4.16xlarge',
              'KeyName': 'XXX',
              'LaunchTime': datetime.datetime(...),
              'Monitoring': {'State': 'disabled'},
              'NetworkInterfaces': [ { 'Attachment': { 'AttachTime': datetime.datetime(...),
                                                       'AttachmentId': 'eni-attach-XXX',
                                                       'DeleteOnTermination': True,
                                                       'DeviceIndex': 0,
                                                       'Status': 'attached'},
                                       'Description': '',
                                       'Groups': [ { 'GroupId': 'sg-CCC',
                                                     'GroupName': '...'}],
                                       'InterfaceType': 'interface',
                                       'Ipv6Addresses': [],
                                       'MacAddress': '...',
                                       'NetworkInterfaceId': 'eni-XXX',
                                       'OwnerId': '...',
                                       'PrivateIpAddress': '...',
                                       'PrivateIpAddresses': [ { 'Primary': True,
                                                                 'PrivateIpAddress': '...'}],
                                       'SourceDestCheck': True,
                                       'Status': 'in-use',
                                       'SubnetId': 'subnet-XXX',
                                       'VpcId': 'vpc-XXX'}],
              'Placement': { 'AvailabilityZone': 'us-east-1a',
                             'GroupName': '',
                             'Tenancy': 'default'},
              'PrivateDnsName': 'ip-XXX.ec2.internal',
              'PrivateIpAddress': '...',
              'ProductCodes': [],
              'PublicDnsName': '',
              'RootDeviceName': '/dev/sda1',
              'RootDeviceType': 'ebs',
              'SecurityGroups': [ { 'GroupId': 'sg-XXX',
                                    'GroupName': '...'}],
              'SourceDestCheck': True,
              'SpotInstanceRequestId': 'sir-XXX',
              'State': {'Code': 16, 'Name': 'running'},
              'StateTransitionReason': '',
              'SubnetId': 'subnet-XXX',
              'Tags': [{'Key': 'Name', 'Value': '...'},
                       {'Key': 'PlacementGroup', 'Value': '...'}],
              'VirtualizationType': 'hvm',
              'VpcId': 'vpc-XXX'}

        """
        filters = [{"Name": "tag:Name", "Values": [self.config.worker_name]}]

        res = {}

        for reservations in self.ec2_client.describe_instances(Filters=filters)[
            "Reservations"
        ]:
            for instance in reservations["Instances"]:
                if (
                    instance["State"]["Name"] in ("running", "pending")
                    if includePending
                    else ("running",)
                ):
                    if (
                        not spot
                        and instance.get("InstanceLifecycle") != "spot"
                        or spot
                        and instance.get("InstanceLifecycle") == "spot"
                    ):
                        res[str(instance["InstanceId"])] = instance

        return res

    def isInstanceWeOwn(self, instance):
        # make sure this instance is definitely one we booted.

        if not [
            t
            for t in instance.tags
            if t["Key"] == "Name" and t["Value"] == self.config.worker_name
        ]:
            return False

        if instance.subnet.id not in self.config.available_subnets:
            return False

        if not [
            t for t in instance.security_groups if t["GroupId"] == self.config.security_group
        ]:
            return False

        if instance.key_pair.name != self.config.keypair:
            return False

        return True

    def terminateSpotRequestById(self, id):
        self.ec2_client.cancel_spot_instance_requests(SpotInstanceRequestsIds=[id])

    def terminateInstanceById(self, id):
        instance = self.ec2.Instance(id)
        assert self.isInstanceWeOwn(instance)
        self._logger.info("Terminating AWS instance %s", instance)
        instance.terminate()

    def getSpotPrices(self):
        self._logger.info("Requesting spot price history...")
        results = {}

        for x in self.ec2_client.get_paginator("describe_spot_price_history").paginate(
            Filters=[{"Name": "product-description", "Values": ["Linux/UNIX"]}],
            StartTime=datetime.datetime.now() - datetime.timedelta(hours=1),
        ):
            for record in x["SpotPriceHistory"]:
                ts = record["Timestamp"]
                instance_type = record["InstanceType"]
                az = record["AvailabilityZone"]

                try:
                    price = float(record["SpotPrice"])
                except Exception:
                    price = None

                if (instance_type, az) not in results:
                    results[(instance_type, az)] = (ts, price)
                elif ts > results[(instance_type, az)][0]:
                    results[(instance_type, az)] = (ts, price)

        to_return = []
        for instance_type, az in results:
            to_return.append((instance_type, az, results[instance_type, az][1]))
        return to_return

    def bootWorker(
        self,
        instanceType,
        authToken,
        clientToken=None,
        nameValueOverride=None,
        extraTags=None,
        wantsTerminateOnShutdown=True,
        spotPrice=None,
        placementGroup="Worker",
        subnet=None,
    ):
        baseBootScript = self.config.bootstrap_script_override or linux_bootstrap_script

        isGpu = computeIsGpu(instanceType)

        if not isGpu:
            bootConfig = self.config.cpu_boot_config
        else:
            bootConfig = self.config.gpu_boot_config
            if bootConfig is None:
                self._logger.info(
                    "Didn't find a gpu boot config while booting a gpu worker. Defaulting "
                    "to the cpu boot config."
                )
                bootConfig = self.config.cpu_boot_config
            else:
                self._logger.info(
                    "Found a gpu boot config while booting a gpu worker. We will use this "
                    "instead of the cpu boot config."
                )

        boot_script = (
            baseBootScript.replace("__db_hostname__", self.config.db_hostname)
            .replace("__db_port__", str(self.config.db_port))
            .replace("__image__", bootConfig.docker_image)
            .replace("__worker_token__", authToken)
            .replace("__placement_group__", placementGroup)
            .replace("__is_gpu__", str(int(isGpu)))
            .replace("__max_service_instances__", str(1 if isGpu else -1))
        )

        if clientToken is None:
            clientToken = str(uuid.uuid4())

        def has_ephemeral_storage(instanceType):
            for t in ["m3", "c3", "x1", "r3", "f1", "h1", "i3", "d2"]:
                if instanceType.startswith(t):
                    return True
            return False

        if has_ephemeral_storage(instanceType):
            deviceMapping = {"DeviceName": "/dev/xvdb", "VirtualName": "ephemeral0"}
        else:
            deviceMapping = {
                "DeviceName": "/dev/xvdb",
                "VirtualName": "ephemeral0",
                "Ebs": {
                    "Encrypted": False,
                    "DeleteOnTermination": True,
                    "VolumeSize": self.config.defaultStorageSize,
                    "VolumeType": "gp2",
                },
            }

        nameValue = nameValueOverride or self.config.worker_name

        ec2_args = dict(
            ImageId=bootConfig.ami,
            InstanceType=instanceType,
            KeyName=self.config.keypair,
            MaxCount=1,
            MinCount=1,
            SecurityGroupIds=[self.config.security_group],
            SubnetId=subnet,
            ClientToken=clientToken,
            InstanceInitiatedShutdownBehavior="terminate"
            if wantsTerminateOnShutdown
            else "stop",
            IamInstanceProfile={"Name": self.config.worker_iam_role_name},
            UserData=boot_script,  # base64.b64encode(boot_script.encode("ASCII")),
            BlockDeviceMappings=[deviceMapping],
            TagSpecifications=[
                {
                    "ResourceType": "instance",
                    "Tags": [
                        {"Key": "Name", "Value": nameValue},
                        {"Key": "PlacementGroup", "Value": placementGroup},
                    ]
                    + [{"Key": k, "Value": v} for (k, v) in (extraTags or {}).items()],
                }
            ],
        )

        if spotPrice:
            ec2_args["InstanceMarketOptions"] = {
                "MarketType": "spot",
                "SpotOptions": {"SpotInstanceType": "one-time", "MaxPrice": str(spotPrice)},
            }

        return str(self.ec2.create_instances(**ec2_args)[0].id)


class AwsWorkerBootService(ServiceBase):
    coresUsed = 0
    gbRamUsed = 0

    def __init__(self, db, service, serviceRuntimeConfig):
        ServiceBase.__init__(self, db, service, serviceRuntimeConfig)

        self._logger = logging.getLogger(__name__)
        self.SLEEP_INTERVAL = 10.0
        self.lastSpotPriceRequest = 0.0

    @staticmethod
    def currentTargets():
        return {s.instance_type: s.desired for s in State.lookupAll()}

    @staticmethod
    def currentBooted():
        return {s.instance_type: s.booted for s in State.lookupAll()}

    @staticmethod
    def setBootState(instance_type, target, placementGroup):
        if instance_type not in valid_instance_types:
            raise Exception(
                "Instance type %s is not a valid instance type. Did you mean one of %s?"
                % (instance_type, closest_N_in(instance_type, valid_instance_types, 3))
            )

        s = State.lookupAny(instance_type_and_pg=(instance_type, placementGroup))
        if not s:
            s = State(instance_type=instance_type, placementGroup=placementGroup)
        s.desired = target

    @staticmethod
    def shutdownAll():
        for s in State.lookupAll():
            s.desired = 0

    @staticmethod
    def shutOneDown(instance_type, placementGroup):
        i = [
            x
            for x in AwsApi().allRunningInstances().values()
            if x["InstanceType"] == instance_type
            and instanceTagValue(x, "PlacementGroup") == placementGroup
        ]
        if not i:
            raise Exception("No instances of type %s are booted." % instance_type)
        else:
            logging.getLogger(__name__).info("Terminating instance %s", i["InstanceId"])

        AwsApi().terminateInstanceById(i[0])

    @staticmethod
    def configure(
        db_hostname,
        db_port,
        region,
        vpc_id,
        subnet,
        security_group,
        keypair,
        worker_name,
        worker_iam_role_name,
        defaultStorageSize,
        max_to_boot,
        available_subnets,
        cpuBootConfig,
        gpuBootConfig=None,
        bootstrap_script_override=None,
    ):
        c = Configuration.lookupAny()
        if not c:
            c = Configuration()

        if db_hostname is not None:
            c.db_hostname = db_hostname
        if db_port is not None:
            c.db_port = db_port
        if region is not None:
            c.region = region
        if vpc_id is not None:
            c.vpc_id = vpc_id
        if subnet is not None:
            c.default_subnet = subnet
        if security_group is not None:
            c.security_group = security_group
        if keypair is not None:
            c.keypair = keypair
        if worker_name is not None:
            c.worker_name = worker_name
        if worker_iam_role_name is not None:
            c.worker_iam_role_name = worker_iam_role_name
        if defaultStorageSize is not None:
            c.defaultStorageSize = defaultStorageSize
        if max_to_boot is not None:
            c.max_to_boot = max_to_boot
        if available_subnets is not None:
            c.available_subnets = available_subnets
        if cpuBootConfig is not None:
            c.cpu_boot_config = cpuBootConfig

        c.gpu_boot_config = gpuBootConfig
        c.bootstrap_script_override = bootstrap_script_override

    def setBootCount(self, instance_type, count, placementGroup):
        state = State.lookupAny(instance_type_and_pg=(instance_type, placementGroup))

        if not state:
            state = State(instance_type=instance_type, placementGroup=placementGroup)

        state.desired = count

    def initialize(self):
        self.db.subscribeToSchema(schema)
        self.db.subscribeToType(service_schema.Service)

        with self.db.transaction():
            self.api = AwsApi()

    def doWork(self, shouldStop):
        while not shouldStop.is_set():
            try:
                if not self.pushTaskLoopForward():
                    time.sleep(1.0)
            except Exception:
                self._logger.exception("Failed:")
                time.sleep(5.0)

    @staticmethod
    def serviceDisplay(serviceObject, instance=None, objType=None, queryArgs=None):
        cells.ensureSubscribedSchema(schema)

        c = Configuration.lookupAny()

        if not c:
            return cells.Card("No configuration defined for  AWS")

        def bootCountSetter(state, ct):
            def f():
                state.desired = ct

            return f

        def bootCountSetterSpot(state, ct):
            def f():
                state.spot_desired = ct

            return f

        def subnetDesc(subnet):
            return f"{subnet} ({c.available_subnets[subnet]})"

        return cells.Tabs(
            requests=cells.VScrollable(
                cells.Grid(
                    colFun=lambda: [
                        "Instance Type",
                        "PlacementGroup",
                        "COST",
                        "RAM",
                        "CPU",
                        "Booted",
                        "Desired",
                        "SpotBooted",
                        "SpotDesired",
                        "ObservedLimit",
                        "CapacityConstrained",
                        "Spot-us-east-1",
                        "a",
                        "b",
                        "c",
                        "d",
                        "e",
                        "f",
                    ],
                    rowFun=lambda: sorted(
                        [
                            x
                            for x in State.lookupAll()
                            if x.instance_type in instance_types_to_show
                        ],
                        key=lambda s: s.instance_type,
                    ),
                    headerFun=lambda x: x,
                    rowLabelFun=None,
                    rendererFun=lambda s, field: cells.Subscribed(
                        lambda: s.instance_type
                        if field == "Instance Type"
                        else s.placementGroup
                        if field == "PlacementGroup"
                        else s.booted
                        if field == "Booted"
                        else cells.Dropdown(
                            s.desired,
                            [
                                (str(ct), bootCountSetter(s, ct))
                                for ct in list(range(10)) + list(range(10, 101, 10))
                            ],
                        )
                        if field == "Desired"
                        else s.spot_booted
                        if field == "SpotBooted"
                        else cells.Dropdown(
                            s.spot_desired,
                            [
                                (str(ct), bootCountSetterSpot(s, ct))
                                for ct in list(range(10)) + list(range(10, 101, 10))
                            ],
                        )
                        if field == "SpotDesired"
                        else ("" if s.observedLimit is None else s.observedLimit)
                        if field == "ObservedLimit"
                        else ("Yes" if s.capacityConstrained else "")
                        if field == "CapacityConstrained"
                        else valid_instance_types[s.instance_type]["COST"]
                        if field == "COST"
                        else valid_instance_types[s.instance_type]["RAM"]
                        if field == "RAM"
                        else valid_instance_types[s.instance_type]["CPU"]
                        if field == "CPU"
                        else s.spotPrices.get("us-east-1" + field, "")
                        if field in "abcdef"
                        else ""
                    ),
                )
            ),
            instances=cells.VScrollable(
                cells.Grid(
                    colFun=lambda: [
                        "InstanceId",
                        "InstanceType",
                        "PlacementGroup",
                        "IsSpot",
                        "Ip",
                        "State",
                        "Subnet",
                    ],
                    rowFun=lambda: sorted(
                        RunningInstance.lookupAll(), key=lambda i: i.instanceId
                    ),
                    headerFun=lambda x: x,
                    rowLabelFun=None,
                    rendererFun=lambda i, field: cells.Subscribed(
                        lambda: i.instanceId
                        if field == "InstanceId"
                        else i.instance_type
                        if field == "InstanceType"
                        else i.placementGroup
                        if field == "PlacementGroup"
                        else i.isSpot
                        if field == "IsSpot"
                        else i.hostname
                        if field == "Ip"
                        else i.state
                        if field == "State"
                        else f"{i.subnet} ({i.availability_zone})"
                        if field == "Subnet"
                        else ""
                    ),
                )
            ),
            config=cells.Card(
                cells.Text("db_hostname = " + str(c.db_hostname))
                + cells.Text("db_port = " + str(c.db_port))
                + cells.Text("region = " + str(c.region))
                + cells.Text("vpc_id = " + str(c.vpc_id))
                + cells.Text("security_group = " + str(c.security_group))
                + cells.Text("keypair = " + str(c.keypair))
                + cells.Text("worker_name = " + str(c.worker_name))
                + cells.Text("worker_iam_role_name = " + str(c.worker_iam_role_name))
                + cells.Text("defaultStorageSize = " + str(c.defaultStorageSize))
                + cells.Text("max_to_boot = " + str(c.max_to_boot))
                + cells.Text("cpu_boot_config = " + str(c.cpu_boot_config))
                + cells.Text("gpu_boot_config = " + str(c.gpu_boot_config))
                + (
                    cells.Text("subnet=")
                    >> cells.Padding()
                    >> cells.Dropdown(
                        cells.Subscribed(
                            lambda: subnetDesc(DynamicConfiguration.currentSubnet())
                        ),
                        [
                            (
                                subnetDesc(k),
                                (lambda k: lambda: DynamicConfiguration.setSubnet(k))(k),
                            )
                            for k in c.available_subnets
                        ],
                    )
                )
            ),
        )

    def mirrorInstancesIntoODB(self, instanceIdToState):
        with self.db.transaction():
            logging.info(
                "synchronize %s states with %s states",
                len(instanceIdToState),
                len(RunningInstance.lookupAll()),
            )

            for instanceId, state in instanceIdToState.items():
                instance = RunningInstance.lookupAny(instanceId=instanceId)
                if instance is None:
                    logging.info("Create record for new instance %s", instanceId)
                    instance = RunningInstance(instanceId=instanceId)
                    instance.isSpot = state.get("InstanceLifecycle") == "spot"
                    instance.instance_type = state.get("InstanceType", "??")
                    instance.placementGroup = instanceTagValue(state, "PlacementGroup")
                    instance.hostname = state.get("PrivateIpAddress", "??")
                    instance.subnet = state["SubnetId"]
                    instance.availability_zone = state["Placement"]["AvailabilityZone"]

                if instance.state != state["State"]["Name"]:
                    instance.state = state["State"]["Name"]

            for instance in RunningInstance.lookupAll():
                if instance.instanceId not in instanceIdToState:
                    logging.info("Remove record for deleted instance %s", instance.instanceId)
                    instance.delete()

    def pushTaskLoopForward(self):
        placementGroups = set()

        with self.db.transaction():
            for service in service_schema.Service.lookupAll():
                placementGroups.update(service.validPlacementGroups)

        if time.time() - self.lastSpotPriceRequest > 60.0:
            with self.db.transaction():
                placementGroups = set()
                for service in service_schema.Service.lookupAll():
                    placementGroups.update(service.validPlacementGroups)

                for instance_type, availability_zone, price in self.api.getSpotPrices():
                    for placementGroup in sorted(placementGroups):
                        if placementGroup != "Master":
                            state = State.lookupAny(
                                instance_type_and_pg=(instance_type, placementGroup)
                            )
                            if not state:
                                state = State(
                                    instance_type=instance_type, placementGroup=placementGroup
                                )

                            if state:
                                state.spotPrices = state.spotPrices + {
                                    availability_zone: price
                                }

            self.lastSpotPriceRequest = time.time()

        with self.db.view():
            onDemandInstances = self.api.allRunningInstances(spot=False)
            spotInstances = self.api.allRunningInstances(spot=True)
            currentSubnet = DynamicConfiguration.currentSubnet()

        self.mirrorInstancesIntoODB(dict(**onDemandInstances, **spotInstances))

        def instanceKey(instance):
            return (instance["InstanceType"], instanceTagValue(instance, "PlacementGroup"))

        def stateKey(state):
            return (state.instance_type, state.placementGroup)

        def subnetForInstance(instance):
            return instance["SubnetId"]

        instancesByType = {}
        spotInstancesByType = {}
        badSubnetInstances = {}

        for machineId, instance in onDemandInstances.items():
            if subnetForInstance(instance) == currentSubnet:
                instancesByType.setdefault(instanceKey(instance), []).append(instance)
            else:
                badSubnetInstances.setdefault(subnetForInstance(instance), []).append(instance)

        for machineId, instance in spotInstances.items():
            if subnetForInstance(instance) == currentSubnet:
                spotInstancesByType.setdefault(instanceKey(instance), []).append(instance)
            else:
                badSubnetInstances.setdefault(subnetForInstance(instance), []).append(instance)

        with self.db.transaction():
            for subnet, instances in badSubnetInstances.items():
                self._logger.info(
                    "We have %s instance(s) booted into subnet %s. Current subnet is %s. "
                    "Shutting down.",
                    len(instances),
                    subnet,
                    currentSubnet,
                )
                for instance in instances:
                    self.api.terminateInstanceById(instance["InstanceId"])

            for state in State.lookupAll():
                if stateKey(state) not in instancesByType:
                    state.booted = 0

                if stateKey(state) not in spotInstancesByType:
                    state.spot_booted = 0

            for instance_type in valid_instance_types:
                for placementGroup in placementGroups:
                    if placementGroup != "Master":
                        if not State.lookupAny(
                            instance_type_and_pg=(instance_type, placementGroup)
                        ):
                            State(instance_type=instance_type, placementGroup=placementGroup)

            for (instance_type, placementGroup), instances in instancesByType.items():
                if placementGroup is not None:
                    state = State.lookupAny(
                        instance_type_and_pg=(instance_type, placementGroup)
                    )
                    if not state:
                        state = State(
                            instance_type=instance_type, placementGroup=placementGroup
                        )
                    state.booted = len(instances)
                else:
                    for instance in instances:
                        self.api.terminateInstanceById(instance["InstanceId"])

            for (instance_type, placementGroup), instances in spotInstancesByType.items():
                if placementGroup is not None:
                    state = State.lookupAny(
                        instance_type_and_pg=(instance_type, placementGroup)
                    )
                    if not state:
                        state = State(
                            instance_type=instance_type, placementGroup=placementGroup
                        )
                    state.spot_booted = len(instances)
                else:
                    for instance in instances:
                        self.api.terminateInstanceById(instance["InstanceId"])

            for state in State.lookupAll():
                if state.placementGroup == "Master":
                    continue

                while state.booted > state.desired:
                    self._logger.info(
                        "We have %s instances of type %s booted "
                        "vs %s desired. Shutting one down.",
                        state.booted,
                        state.instance_type,
                        state.desired,
                    )

                    instance = instancesByType[stateKey(state)].pop()
                    self.api.terminateInstanceById(instance["InstanceId"])
                    state.booted -= 1

                while state.spot_booted > state.spot_desired:
                    self._logger.info(
                        "We have %s spot instances of type %s requested vs %s desired. "
                        + "Terminating one down.",
                        state.spot_booted,
                        state.instance_type,
                        state.spot_desired,
                    )

                    instance = spotInstancesByType[stateKey(state)].pop()
                    self.api.terminateInstanceById(instance["InstanceId"])
                    state.spot_booted -= 1

                while state.booted < state.desired:
                    self._logger.info(
                        "We have %s instances of type %s booted vs %s desired. Booting one.",
                        state.booted,
                        state.instance_type,
                        state.desired,
                    )

                    try:
                        self.api.bootWorker(
                            state.instance_type,
                            self.runtimeConfig.authToken,
                            placementGroup=state.placementGroup,
                            subnet=currentSubnet,
                        )

                        state.booted += 1
                        state.capacityConstrained = False
                    except Exception as e:
                        if "InsufficientInstanceCapacity" in str(e):
                            state.desired = state.booted
                            state.capacityConstrained = True
                        elif "You have requested more instances " in str(e):
                            maxCount = int(
                                str(e)
                                .split("than your current instance limit of ")[1]
                                .split(" ")[0]
                            )
                            self._logger.info(
                                "Visible limit of %s observed for instance type %s",
                                maxCount,
                                state.instance_type,
                            )
                            state.observedLimit = maxCount
                            state.desired = min(state.desired, maxCount)
                        else:
                            self._logger.exception("Failed to boot a worker:")
                            time.sleep(self.SLEEP_INTERVAL)
                            break

                while state.spot_booted < state.spot_desired:
                    self._logger.info(
                        "We have %s spot instances of type %s booted "
                        "for group %s, vs %s desired. Booting one.",
                        state.spot_booted,
                        state.instance_type,
                        state.placementGroup,
                        state.spot_desired,
                    )

                    try:
                        self.api.bootWorker(
                            state.instance_type,
                            self.runtimeConfig.authToken,
                            spotPrice=valid_instance_types[state.instance_type]["COST"],
                            placementGroup=state.placementGroup,
                            subnet=currentSubnet,
                        )
                        state.spot_booted += 1
                    except Exception as e:
                        if "You have requested more instances " in str(e):
                            maxCount = int(
                                str(e)
                                .split("than your current instance limit of ")[1]
                                .split(" ")[0]
                            )
                            self._logger.info(
                                "Visible limit of %s observed for instance type %s",
                                maxCount,
                                state.instance_type,
                            )
                            state.observedLimit = maxCount
                            state.desired = min(state.desired, maxCount)
                        else:
                            self._logger.exception("Failed to boot a worker:")
                            break

        time.sleep(self.SLEEP_INTERVAL)
