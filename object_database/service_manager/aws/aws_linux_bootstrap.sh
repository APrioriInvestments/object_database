#!/bin/bash

set -o errexit
set -o pipefail
set -o nounset
set -o xtrace

export STORAGE=/media/ephemeral0

machineId=$(curl http://169.254.169.254/latest/meta-data/instance-id)

echo "****************"
if [ -b /dev/xvdb ]; then
    echo "Mounting /dev/xvdb to $STORAGE"
    sudo mkfs -t ext4 /dev/xvdb
    sudo mkdir -p $STORAGE
    sudo mount /dev/xvdb $STORAGE
else
    echo "Mounting /dev/nvme1n1 to $STORAGE"
    sudo mkfs -t ext4 /dev/nvme1n1
    sudo mkdir -p $STORAGE
    sudo mount /dev/nvme1n1 $STORAGE
fi

echo "****************"
echo 'df -h $STORAGE'
df -h $STORAGE
echo "****************"

if ! command -v docker &> /dev/null
then
    echo "Docker is not installed. installing it using apt."

    sudo apt-get update
    sudo apt-get install -y docker.io
    sudo service docker start
fi

echo "Moving docker directory to $STORAGE"
sudo service docker stop

sudo cp /var/lib/docker $STORAGE -r
sudo rm /var/lib/docker -rf
(cd /var/lib; sudo ln -s $STORAGE/docker)

# make sure DNS is working
echo "Restarting DNS server."
sudo service systemd-resolved restart

echo "Starting docker"

sudo service docker start

sudo chmod 777 /var/run/docker.sock

sudo mkdir /image_hash

sudo echo __image__ > /image_hash/image.txt

totalk=$(awk '/^MemTotal:/{print $2}' /proc/meminfo)

set +o errexit
while true; do
    IMAGE=$(sudo cat /image_hash/image.txt)

    echo "Pulling docker image $IMAGE"
    sudo docker pull $IMAGE
    pullRes=$?
    if (( $pullRes != 0 )); then
        echo "Failed to pull docker image $IMAGE"

        # restart the DNS server since that can sometimes be a problem
        echo "Restarting DNS server."
        sudo service systemd-resolved restart

        sleep 15
        continue
    fi

    echo "Running docker image $IMAGE"
    sudo docker run --privileged --network=host --dns=127.0.0.53 -m $((totalk/1024/1024 - 1))G -v $STORAGE:/storage -v /image_hash:/image_hash $IMAGE \
        $(hostname) \
        __db_hostname__ \
        __db_port__ \
        __placement_group__ \
        --proxy-port __db_port__ \
        --service-token __worker_token__ \
        --watch-aws-image-hash /image_hash/image.txt

    echo "Docker container restarting."
    sleep 1
done
