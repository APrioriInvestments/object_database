# Using 3.8 because typed_python doesn't seem to
# compile with 3.9 (as of 2022-04-27)
FROM python:3.8-slim as builder

ADD . /opt/object_database

RUN apt update -y -qq \
    && apt upgrade -y -qq \
    && apt install -y -qq curl libssl-dev build-essential git npm \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN pip install --upgrade pip \
    && pip install typed_python \
    && cd /opt/object_database \
    && pip install -e .

RUN cd /opt/object_database/object_database/web/content \
    && npm install \
    && npm run build

CMD ["object_database_webtest"]