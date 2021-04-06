"""
Cells Demo Automated Testing Configuration
------------------------------------------
This file contains pytest fixtures that will
permit automated testing of the various
CellsDemo classes and files.
See:
https://docs.pytest.org/en/latest/fixture.html
for a more detailed description of this pattern.
"""
import pytest

import sys
import requests
import tempfile
import textwrap

from time import sleep
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.common.by import By

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


def bootup_server(tmpDirName):
    token = genToken()
    port = 8020
    loglevel_name = "INFO"

    server = startServiceManagerProcess(
        tmpDirName, port, token, loglevelName=loglevel_name, logDir=False, verbose=True
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
        [
            "--port",
            "8000",
            "--internal-port",
            "8001",
            "--host",
            "0.0.0.0",
            "--log-level",
            loglevel_name,
        ],
    )

    ActiveWebService.setLoginPlugin(
        database, service, LoginIpPlugin, [None], config={"company_name": "A Testing Company"}
    )

    with database.transaction():
        ServiceManager.startService("ActiveWebService", 1)

    with database.transaction():
        service = ServiceManager.createOrUpdateService(
            CellsTestService, "CellsTestService", target_count=1
        )

    with database.transaction():
        ServiceManager.createOrUpdateService(
            "test_service.service.TestService",
            "TestService",
            10,
            codebase=service_schema.Codebase.createFromFiles(
                {
                    "test_service/__init__.py": "",
                    "test_service/service.py": textwrap.dedent(TEST_SERVICE),
                }
            ),
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
    driver = webdriver.Chrome(
        options=options, desired_capabilities={"goog:loggingPrefs": {"browser": "ALL"}}
    )

    return driver


class HeadlessTester:
    def __init__(self, endpoint=None, demo_root_name="demo_root"):
        if not endpoint:
            self.endpoint = "http://127.0.0.1:8000"
        else:
            self.endpoint = endpoint

        # Set the demo root data attr
        # tag value to use when querying
        self.demo_root_name = demo_root_name

        # Note that here we start the server
        # and the webdriver on initialization
        self.tempDir = tempfile.TemporaryDirectory()
        self.server = bootup_server(self.tempDir.name)
        self.webdriver = bootup_webdriver()
        self.webdriver.implicitly_wait(5)

    @property
    def expect(self):
        return expected_conditions

    @property
    def by(self):
        return By

    def dumpLogs(self):
        for msg in self.webdriver.get_log("browser"):
            print("SELENIUM LOG > ", msg)

    @property
    def demo_root_selector(self):
        return '[data-tag="{}"]'.format(self.demo_root_name)

    def wait(self, seconds):
        return WebDriverWait(self.webdriver, seconds)

    def url_for_demo(self, DemoClass):
        "Respond with the full URL for a given CellsDemo class"
        inst = DemoClass()
        return "{}/services/CellsTestService{}".format(self.endpoint, inst.querystring())

    def load_demo_page(self, DemoClass):
        """Loads the specified DemoClass of a
        CellsTestPage into the headless browser
        """
        self.webdriver.get(self.url_for_demo(DemoClass))
        self.wait(10).until(
            self.expect.visibility_of_element_located((self.by.CSS_SELECTOR, "body"))
        )

    def get_demo_root_for(self, DemoClass):
        """Load the demo page for the specified
        CellsTestPage class and return the root element
        for it.
        This is a combination of
        load_demo_page and get_demo_root
        """
        self.load_demo_page(DemoClass)
        return self.get_demo_root()

    def find_by_css(self, css_string, many=False):
        if many:
            return self.webdriver.find_elements_by_css_selector(css_string)
        return self.webdriver.find_element_by_css_selector(css_string)

    def get_demo_root(self):
        selector = self.demo_root_selector
        return self.webdriver.find_element_by_css_selector(selector)

    @property
    def window_handles(self):
        return self.webdriver.window_handles

    @property
    def current_url(self):
        return self.webdriver.current_url

    def switch_to_window(self, handle):
        return self.webdriver.switch_to_window(handle)


@pytest.fixture(scope="session")
def headless_browser():
    # First, we start the object database
    # service and the web service
    tester = HeadlessTester()
    yield tester
    tester.dumpLogs()
    tester.webdriver.close()
    tester.server.terminate()
    tester.server.wait()
    tester.tempDir.cleanup()


def test_server_connect(headless_browser):
    try:
        response = requests.get(headless_browser.endpoint)
        status_code = response.status_code
        print("connection successful")
        print(status_code)
        connected = True
    except ConnectionError:
        connected = False
    assert connected


def test_webdriver_basic_connect(headless_browser):
    headless_browser.webdriver.get(headless_browser.endpoint)
    query = "body"
    el = headless_browser.find_by_css(query)
    assert el


def test_server_loads_page(headless_browser):
    headless_browser.webdriver.get(headless_browser.endpoint)
    print(headless_browser.webdriver.page_source)
    query = "#page_root"
    el = headless_browser.find_by_css(query)
    assert el


def test_webdriver(headless_browser):
    headless_browser.webdriver.get("http://www.python.org")
    assert "Python" in headless_browser.webdriver.title
