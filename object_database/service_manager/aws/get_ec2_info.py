"""Hilariously, this is the best way to get the AWS pricing.

Alternatives:
    1. Hit and parse url:
        'https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/index.json'
        (cost is wrong)
    2. Use 'aws pricing' CLI (cost is sometimes zero).
"""
import pandas as pd
import json

AWS_TABLE_URL = "https://instances.vantage.sh/"
OUTPUT_PATH = "ec2_pricing.json"
ec2_df = pd.read_html(AWS_TABLE_URL)[0]
ec2_available_df = ec2_df[ec2_df["On Demand"] != "unavailable"]

final_dict = (
    ec2_available_df.assign(
        **{
            "RAM": ec2_available_df["Instance Memory"].str.replace(" GiB", "").astype(float),
            "CPU": ec2_available_df["vCPUs"].str.split().str[0].astype(int),
            "COST": ec2_available_df["On Demand"]
            .str.replace(r"$", "")
            .str.split()
            .str[0]
            .astype(float),
        }
    )[["API Name", "RAM", "CPU", "COST"]]
    .set_index("API Name")
    .to_dict(orient="index")
)

with open(OUTPUT_PATH, "w") as f:
    json.dump(final_dict, f, indent=2, sort_keys=True)
