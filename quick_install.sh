git clone https://github.com/APrioriInvestments/object_database
apt-get update
apt-get install gcc
apt-get install python3-dev && apt-get install libssl-dev
apt-get update && sudo apt-get install --reinstall build-essential
cd object_database
python3 -m venv .venv
. .venv/bin/activate
export PYTHONPATH=`pwd`
pip install -e .
pip install flask-sockets
pip install urllib3==1.25.4
cd object_database/web/content/
nodeenv --node=16.16.0 --prebuilt .nenv
source .nenv/bin/activate
npm install
npm run build
object_database_webtest
