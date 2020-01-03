import sys
import requests
import tempfile
import unittest
import textwrap

from time import sleep
from selenium import webdriver

# from selenium.webdriver.common.keys import Keys
from requests.exceptions import ConnectionError
from object_database.util import genToken
from object_database.web.LoginPlugin import LoginIpPlugin
from object_database import connect, core_schema, service_schema
from object_database.web.CellsTestService import CellsTestService
from object_database.web.ActiveWebService import ActiveWebService
from object_database.service_manager.ServiceManager import ServiceManager
from object_database.web.ActiveWebServiceSchema import active_webservice_schema
from object_database.frontends.service_manager import startServiceManagerProcess


TEST_SERVICE = """
    from object_database.service_manager.ServiceBase import ServiceBase

    class TestService(ServiceBase):
        gbRamUsed = 0
        coresUsed = 0

        def initialize(self):
            with self.db.transaction():
                self.runtimeConfig.serviceInstance.statusMessage = "Loaded"

        def doWork(self, shouldStop):
            shouldStop.wait()

        def display(self, queryParams=None):
            return "test service display message"
    """


def bootup_server():
    token = genToken()
    port = 8020
    loglevel_name = "INFO"
    with tempfile.TemporaryDirectory() as tmpDirName:
        server = startServiceManagerProcess(
            tmpDirName, port, token, loglevelName=loglevel_name, logDir=False, verbose=False
        )
        database = connect("localhost", port, token, retry=True)
        database.subscribeToSchema(core_schema, service_schema, active_webservice_schema)

        with database.transaction():
            service = ServiceManager.createOrUpdateService(
                ActiveWebService, "ActiveWebService", target_count=0
            )

        ActiveWebService.configureFromCommandline(
            database,
            service,
            ["--port", "8000", "--host", "0.0.0.0", "--log-level", loglevel_name],
        )

        ActiveWebService.setLoginPlugin(
            database,
            service,
            LoginIpPlugin,
            [None],
            config={"company_name": "A Testing Company"},
        )

        with database.transaction():
            ServiceManager.startService("ActiveWebService", 1)

        with database.transaction():
            service = ServiceManager.createOrUpdateService(
                CellsTestService, "CellsTestService", target_count=1
            )

        with database.transaction():
            ServiceManager.createOrUpdateServiceWithCodebase(
                service_schema.Codebase.createFromFiles(
                    {
                        "test_service/__init__.py": "",
                        "test_service/service.py": textwrap.dedent(TEST_SERVICE),
                    }
                ),
                "test_service.service.TestService",
                "TestService",
                10,
            )

        print("server is booted")
        try_to_connect = True
        counter = 0
        print("pinging server")
        while try_to_connect:
            counter += 1
            sys.stdout.write(".")
            sys.stdout.flush()
            try:
                response = requests.get("http://127.0.0.1:8000")
                status_code = response.status_code
                print("connection successfull")
                print(status_code)
                try_to_connect = False
            except ConnectionError:
                sleep(2)
                continue
    return server


def bootup_webdriver():
    """
    Notes: in order to run headless Chrome with selenium you need to have the
    chrome and the chromedriver installed. The version of the driver MUST match
    the version of the browser. Below are instructions for Chrome 79.

    Install Chrome:
    (this will get the latest version which is 79 as of writing)
    wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
    sudo dpkg -i google-chrome-stable_current_amd64.deb
    (this will install in `/usr/bin/google-chrome` you can choose another
    location but make sure you tell the selenium webdriver that, see below
    inline)

    Install the driver:
    wget https://chromedriver.storage.googleapis.com/79.0.3945.36/chromedriver_linux64.zip
    unzip chromedriver_linux64.zip (this threw a weird error for me but it
    should work... i unzipped it using the OSX util)
    sudo mv chromedriver /usr/local/bin/chromedriver
    """
    print("setting up selenium webdriver for Chrome")

    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    # options.add_argument('--no-sandbox')
    # options.add_argument('--disable-dev-shm-usage')

    # Note: if you installed the browser and the driver somewhere outside of
    # /usr/bin or /usr/local/bin you can change tha paths and boot up the
    # driver as below; otherwise the defaults should resolve
    # chrome_path = '/usr/local/bin/chromedriver'
    # options.binary_location = '/usr/bin/google-chrome'
    # driver = webdriver.Chrome(executable_path=chrome_path, chrome_options=options)

    # start upu the driver
    driver = webdriver.Chrome(options=options)
    return driver


class CellsDemo(unittest.TestCase):
    @classmethod
    def setUpClass(self):
        self.endpoint = "http://127.0.0.1:8000"
        print("setting up")
        print("booting server")
        self.server = bootup_server()
        self.webdriver = bootup_webdriver()

    def test_server_connect(self):
        try:
            response = requests.get(self.endpoint)
            status_code = response.status_code
            print("connection successfull")
            print(status_code)
            connected = True
        except ConnectionError:
            connected = False
        self.assertTrue(connected)

    def test_webdriver(self):
        self.webdriver.get("http://www.python.org")
        self.assertIn("Python", self.webdriver.title)

    def test_home_redirect(self):
        self.webdriver.get(self.endpoint)
        self.assertEqual(self.webdriver.current_url, self.endpoint + "/services")

    @classmethod
    def tearDownClass(self):
        print("tearing down")
        self.webdriver.close()
        self.server.terminate()
        self.server.wait()


if __name__ == "__main__":
    unittest.main()
