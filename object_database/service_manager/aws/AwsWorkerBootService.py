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
from typed_python import OneOf, ConstDict
from object_database import ServiceBase, Schema, Indexed, Index
from object_database.web import cells
from object_database.util import closest_N_in
from object_database.service_manager.ServiceSchema import service_schema

schema = Schema("core.AwsWorkerBootService")


valid_instance_types = {
    "m1.small": {"RAM": 1.7, "CPU": 1, "COST": 0.044},
    "m1.medium": {"RAM": 3.75, "CPU": 1, "COST": 0.087},
    "m1.large": {"RAM": 7.5, "CPU": 2, "COST": 0.175},
    "m1.xlarge": {"RAM": 15, "CPU": 4, "COST": 0.35},
    "c1.medium": {"RAM": 1.7, "CPU": 2, "COST": 0.13},
    "c1.xlarge": {"RAM": 7, "CPU": 8, "COST": 0.52},
    "cc2.8xlarge": {"RAM": 60.5, "CPU": 32, "COST": 2},
    "m2.xlarge": {"RAM": 17.1, "CPU": 2, "COST": 0.245},
    "m2.2xlarge": {"RAM": 34.2, "CPU": 4, "COST": 0.49},
    "m2.4xlarge": {"RAM": 68.4, "CPU": 8, "COST": 0.98},
    "hs1.8xlarge": {"RAM": 117, "CPU": 16, "COST": 4.6},
    "m5.large": {"RAM": 8, "CPU": 2, "COST": 0.096},
    "m5.xlarge": {"RAM": 16, "CPU": 4, "COST": 0.192},
    "m5.2xlarge": {"RAM": 32, "CPU": 8, "COST": 0.384},
    "m5.4xlarge": {"RAM": 64, "CPU": 16, "COST": 0.768},
    "m5.12xlarge": {"RAM": 192, "CPU": 48, "COST": 2.304},
    "m5.24xlarge": {"RAM": 384, "CPU": 96, "COST": 4.608},
    "m4.large": {"RAM": 8, "CPU": 2, "COST": 0.1},
    "m4.xlarge": {"RAM": 16, "CPU": 4, "COST": 0.2},
    "m4.2xlarge": {"RAM": 32, "CPU": 8, "COST": 0.4},
    "m4.4xlarge": {"RAM": 64, "CPU": 16, "COST": 0.8},
    "m4.10xlarge": {"RAM": 160, "CPU": 40, "COST": 2},
    "m4.16xlarge": {"RAM": 256, "CPU": 64, "COST": 3.2},
    "c5.large": {"RAM": 4, "CPU": 2, "COST": 0.085},
    "c5.xlarge": {"RAM": 8, "CPU": 4, "COST": 0.17},
    "c5.2xlarge": {"RAM": 16, "CPU": 8, "COST": 0.34},
    "c5.4xlarge": {"RAM": 32, "CPU": 16, "COST": 0.68},
    "c5.9xlarge": {"RAM": 72, "CPU": 36, "COST": 1.53},
    "c5.18xlarge": {"RAM": 144, "CPU": 72, "COST": 3.06},
    "c4.large": {"RAM": 3.75, "CPU": 2, "COST": 0.1},
    "c4.xlarge": {"RAM": 7.5, "CPU": 4, "COST": 0.199},
    "c4.2xlarge": {"RAM": 15, "CPU": 8, "COST": 0.398},
    "c4.4xlarge": {"RAM": 30, "CPU": 16, "COST": 0.796},
    "c4.8xlarge": {"RAM": 60, "CPU": 36, "COST": 1.591},
    "r5.large": {"RAM": 16, "CPU": 2, "COST": 0.126},
    "r5.xlarge": {"RAM": 32, "CPU": 4, "COST": 0.252},
    "r5.2xlarge": {"RAM": 64, "CPU": 8, "COST": 0.504},
    "r5.4xlarge": {"RAM": 128, "CPU": 16, "COST": 1.008},
    "r5.12xlarge": {"RAM": 384, "CPU": 48, "COST": 3.024},
    "r5.24xlarge": {"RAM": 768, "CPU": 96, "COST": 6.047},
    "r4.large": {"RAM": 15.25, "CPU": 2, "COST": 0.133},
    "r4.xlarge": {"RAM": 30.5, "CPU": 4, "COST": 0.266},
    "r4.2xlarge": {"RAM": 61, "CPU": 8, "COST": 0.532},
    "r4.4xlarge": {"RAM": 122, "CPU": 16, "COST": 1.064},
    "r4.8xlarge": {"RAM": 244, "CPU": 32, "COST": 2.128},
    "r4.16xlarge": {"RAM": 488, "CPU": 64, "COST": 4.256},
    "p3.2xlarge": {"RAM": 61, "CPU": 8, "COST": 3.06},
    "p3.8xlarge": {"RAM": 244, "CPU": 32, "COST": 12.24},
    "p3.16xlarge": {"RAM": 488, "CPU": 64, "COST": 24.48},
    "p2.xlarge": {"RAM": 61, "CPU": 4, "COST": 0.9},
    "p2.8xlarge": {"RAM": 488, "CPU": 32, "COST": 7.2},
    "p2.16xlarge": {"RAM": 732, "CPU": 64, "COST": 14.4},
    "g3.4xlarge": {"RAM": 122, "CPU": 16, "COST": 1.14},
    "g3.8xlarge": {"RAM": 244, "CPU": 32, "COST": 2.28},
    "g3.16xlarge": {"RAM": 488, "CPU": 64, "COST": 4.56},
    "h1.2xlarge": {"RAM": 32, "CPU": 8, "COST": 0.468},
    "h1.4xlarge": {"RAM": 64, "CPU": 16, "COST": 0.936},
    "h1.8xlarge": {"RAM": 128, "CPU": 32, "COST": 1.872},
    "h1.16xlarge": {"RAM": 256, "CPU": 64, "COST": 3.744},
    "d2.xlarge": {"RAM": 30.5, "CPU": 4, "COST": 0.69},
    "d2.2xlarge": {"RAM": 61, "CPU": 8, "COST": 1.38},
    "d2.4xlarge": {"RAM": 122, "CPU": 16, "COST": 2.76},
    "d2.8xlarge": {"RAM": 244, "CPU": 36, "COST": 5.52},
    "m3.medium": {"RAM": 3.75, "CPU": 1, "COST": 0.067},
    "m3.large": {"RAM": 7.5, "CPU": 2, "COST": 0.133},
    "m3.xlarge": {"RAM": 15, "CPU": 4, "COST": 0.266},
    "m3.2xlarge": {"RAM": 30, "CPU": 8, "COST": 0.532},
    "c3.large": {"RAM": 3.75, "CPU": 2, "COST": 0.105},
    "c3.xlarge": {"RAM": 7.5, "CPU": 4, "COST": 0.21},
    "c3.2xlarge": {"RAM": 15, "CPU": 8, "COST": 0.42},
    "c3.4xlarge": {"RAM": 30, "CPU": 16, "COST": 0.84},
    "c3.8xlarge": {"RAM": 60, "CPU": 32, "COST": 1.68},
    "g2.2xlarge": {"RAM": 15, "CPU": 8, "COST": 0.65},
    "g2.8xlarge": {"RAM": 60, "CPU": 32, "COST": 2.6},
    "cr1.8xlarge": {"RAM": 244, "CPU": 32, "COST": 3.5},
    "x1.16xlarge": {"RAM": 976, "CPU": 64, "COST": 6.669},
    "x1.32xlarge": {"RAM": 1952, "CPU": 128, "COST": 13.338},
    "x1e.xlarge": {"RAM": 122, "CPU": 4, "COST": 0.834},
    "x1e.2xlarge": {"RAM": 244, "CPU": 8, "COST": 1.668},
    "x1e.4xlarge": {"RAM": 488, "CPU": 16, "COST": 3.336},
    "x1e.8xlarge": {"RAM": 976, "CPU": 32, "COST": 6.672},
    "x1e.16xlarge": {"RAM": 1952, "CPU": 64, "COST": 13.344},
    "x1e.32xlarge": {"RAM": 3904, "CPU": 128, "COST": 26.688},
    "r3.large": {"RAM": 15.25, "CPU": 2, "COST": 0.166},
    "r3.xlarge": {"RAM": 30.5, "CPU": 4, "COST": 0.333},
    "r3.2xlarge": {"RAM": 61, "CPU": 8, "COST": 0.665},
    "r3.4xlarge": {"RAM": 122, "CPU": 16, "COST": 1.33},
    "r3.8xlarge": {"RAM": 244, "CPU": 32, "COST": 2.66},
    "i2.xlarge": {"RAM": 30.5, "CPU": 4, "COST": 0.853},
    "i2.2xlarge": {"RAM": 61, "CPU": 8, "COST": 1.705},
    "i2.4xlarge": {"RAM": 122, "CPU": 16, "COST": 3.41},
    "i2.8xlarge": {"RAM": 244, "CPU": 32, "COST": 6.82},
    "m5d.large": {"RAM": 8, "CPU": 2, "COST": 0.113},
    "m5d.xlarge": {"RAM": 16, "CPU": 4, "COST": 0.226},
    "m5d.2xlarge": {"RAM": 32, "CPU": 8, "COST": 0.452},
    "m5d.4xlarge": {"RAM": 64, "CPU": 16, "COST": 0.904},
    "m5d.12xlarge": {"RAM": 192, "CPU": 48, "COST": 2.712},
    "m5d.24xlarge": {"RAM": 384, "CPU": 96, "COST": 5.424},
    "c5d.large": {"RAM": 4, "CPU": 2, "COST": 0.096},
    "c5d.xlarge": {"RAM": 8, "CPU": 4, "COST": 0.192},
    "c5d.2xlarge": {"RAM": 16, "CPU": 8, "COST": 0.384},
    "c5d.4xlarge": {"RAM": 32, "CPU": 16, "COST": 0.768},
    "c5d.9xlarge": {"RAM": 72, "CPU": 36, "COST": 1.728},
    "c5d.18xlarge": {"RAM": 144, "CPU": 72, "COST": 3.456},
    "r5d.large": {"RAM": 16, "CPU": 2, "COST": 0.144},
    "r5d.xlarge": {"RAM": 32, "CPU": 4, "COST": 0.288},
    "r5d.2xlarge": {"RAM": 64, "CPU": 8, "COST": 0.576},
    "r5d.4xlarge": {"RAM": 128, "CPU": 16, "COST": 1.152},
    "r5d.12xlarge": {"RAM": 384, "CPU": 48, "COST": 3.456},
    "r5d.24xlarge": {"RAM": 768, "CPU": 96, "COST": 6.912},
    "z1d.large": {"RAM": 16, "CPU": 2, "COST": 0.186},
    "z1d.xlarge": {"RAM": 32, "CPU": 4, "COST": 0.372},
    "z1d.2xlarge": {"RAM": 64, "CPU": 8, "COST": 0.744},
    "z1d.3xlarge": {"RAM": 96, "CPU": 12, "COST": 1.116},
    "z1d.6xlarge": {"RAM": 192, "CPU": 24, "COST": 2.232},
    "z1d.12xlarge": {"RAM": 384, "CPU": 48, "COST": 4.464},
    "f1.2xlarge": {"RAM": 122, "CPU": 8, "COST": 1.65},
    "f1.16xlarge": {"RAM": 976, "CPU": 64, "COST": 13.2},
    "i3.large": {"RAM": 15.25, "CPU": 2, "COST": 0.156},
    "i3.xlarge": {"RAM": 30.5, "CPU": 4, "COST": 0.312},
    "i3.2xlarge": {"RAM": 61, "CPU": 8, "COST": 0.624},
    "i3.4xlarge": {"RAM": 122, "CPU": 16, "COST": 1.248},
    "i3.8xlarge": {"RAM": 244, "CPU": 32, "COST": 2.496},
    "i3.16xlarge": {"RAM": 488, "CPU": 64, "COST": 4.992},
}


instance_types_to_show = set(
    [
        x
        for x in valid_instance_types
        if ("xlarge" in x and ".xlarge" not in x)
        and x.split(".")[0] in ["m4", "m5", "c4", "c5", "r4", "r5", "i3", "g2", "x1"]
    ]
)


def instanceTagValue(instance, tag):
    """Given an instance dict (from boto, see comment on 'allRunningInstances'), what's the
    value of tag 'tag', or None if not provided."""
    for tagDict in instance["Tags"]:
        if tagDict["Key"] == tag:
            return tagDict["Value"]
    return None


@schema.define
class Configuration:
    db_hostname = str  # hostname to connect back to
    db_port = int  # port to connect back to
    region = str  # region to boot into
    vpc_id = str  # id of vpc to boot into
    subnet = str  # id of subnet to boot into
    security_group = str  # id of security group to boot into
    keypair = str  # security keypair name to use
    worker_name = str  # name of workers. This should be unique to this install.
    worker_iam_role_name = str  # AIM role to boot workers into
    docker_image = str  # docker image that runs the actual odb service
    defaultStorageSize = int  # gb of disk to mount on booted workers (if they need ebs)
    max_to_boot = int  # maximum number of workers we'll boot

    ami_override = OneOf(None, str)  # the AMI to use, if not our default
    bootstrap_script_override = OneOf(None, str)  # the bootstrap script to use


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

        if instance.subnet.id != self.config.subnet:
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
        amiOverride=None,
        nameValueOverride=None,
        extraTags=None,
        wantsTerminateOnShutdown=True,
        spotPrice=None,
        placementGroup="Worker",
    ):
        baseBootScript = self.config.bootstrap_script_override or linux_bootstrap_script

        boot_script = (
            baseBootScript.replace("__db_hostname__", self.config.db_hostname)
            .replace("__db_port__", str(self.config.db_port))
            .replace("__image__", self.config.docker_image)
            .replace("__worker_token__", authToken)
            .replace("__placement_group__", placementGroup)
        )

        if clientToken is None:
            clientToken = str(uuid.uuid4())

        if amiOverride is not None:
            ami = amiOverride
        elif self.config.ami_override is not None:
            ami = self.config.ami_override
        else:
            ami = "ami-759bc50a"  # ubuntu 16.04 hvm-ssd

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
            ImageId=ami,
            InstanceType=instanceType,
            KeyName=self.config.keypair,
            MaxCount=1,
            MinCount=1,
            SecurityGroupIds=[self.config.security_group],
            SubnetId=self.config.subnet,
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
            for x in AwsApi.allRunningInstances().values()
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
        docker_image,
        defaultStorageSize,
        max_to_boot,
        amiOverride=None,
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
            c.subnet = subnet
        if security_group is not None:
            c.security_group = security_group
        if keypair is not None:
            c.keypair = keypair
        if worker_name is not None:
            c.worker_name = worker_name
        if worker_iam_role_name is not None:
            c.worker_iam_role_name = worker_iam_role_name
        if docker_image is not None:
            c.docker_image = docker_image
        if defaultStorageSize is not None:
            c.defaultStorageSize = defaultStorageSize
        if max_to_boot is not None:
            c.max_to_boot = max_to_boot

        c.ami_override = amiOverride
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

        return cells.Tabs(
            requests=cells.Grid(
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
            ),
            instances=cells.Grid(
                colFun=lambda: [
                    "InstanceId",
                    "InstanceType",
                    "PlacementGroup",
                    "IsSpot",
                    "Ip",
                    "State",
                ],
                rowFun=lambda: sorted(RunningInstance.lookupAll(), key=lambda i: i.instanceId),
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
                    else ""
                ),
            ),
            config=cells.Card(
                cells.Text("db_hostname = " + str(c.db_hostname))
                + cells.Text("db_port = " + str(c.db_port))
                + cells.Text("region = " + str(c.region))
                + cells.Text("vpc_id = " + str(c.vpc_id))
                + cells.Text("subnet = " + str(c.subnet))
                + cells.Text("security_group = " + str(c.security_group))
                + cells.Text("keypair = " + str(c.keypair))
                + cells.Text("worker_name = " + str(c.worker_name))
                + cells.Text("worker_iam_role_name = " + str(c.worker_iam_role_name))
                + cells.Text("docker_image = " + str(c.docker_image))
                + cells.Text("defaultStorageSize = " + str(c.defaultStorageSize))
                + cells.Text("max_to_boot = " + str(c.max_to_boot))
                + cells.Text("ami_override = " + str(c.ami_override))
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

        self.mirrorInstancesIntoODB(dict(**onDemandInstances, **spotInstances))

        def instanceKey(instance):
            return (instance["InstanceType"], instanceTagValue(instance, "PlacementGroup"))

        def stateKey(state):
            return (state.instance_type, state.placementGroup)

        instancesByType = {}
        spotInstancesByType = {}

        for machineId, instance in onDemandInstances.items():
            instancesByType.setdefault(instanceKey(instance), []).append(instance)

        for machineId, instance in spotInstances.items():
            spotInstancesByType.setdefault(instanceKey(instance), []).append(instance)

        with self.db.transaction():
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
