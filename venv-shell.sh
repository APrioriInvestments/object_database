#! /usr/bin/env bash

OWN_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

CMD=". ~/.bashrc; . '${OWN_DIR}/.env'; . '${OWN_DIR}/.venv/bin/activate'"

bash --rcfile <(echo "${CMD}")
