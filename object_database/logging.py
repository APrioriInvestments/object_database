import datetime
import logging
import pytz


class TimezonedFormatter(logging.Formatter):
    """Allows to override the system timezone."""

    def __init__(self, *args, timezone=None, **kwargs):
        if timezone is None:
            timezone = pytz.timezone("UTC")

        if isinstance(timezone, str):
            timezone = pytz.timezone(timezone)

        super().__init__(*args, **kwargs)
        self.timezone = timezone

    def converter(self, timestamp):
        """Returns a timezone-aware datetime.datetime object."""
        return datetime.datetime.fromtimestamp(timestamp, self.timezone)

    def formatTime(self, record, datefmt=None):
        dt = self.converter(record.created)

        if datefmt:
            return dt.strftime(datefmt)

        else:
            try:
                return dt.isoformat(sep=" ", timespec="milliseconds")

            except Exception:
                return dt.isoformat(sep=" ")
