#settings are read on import, so give the tests a database url before any backend module loads;
#the tests build their own in-memory sqlite engine, so this is never actually connected to
import os

os.environ.setdefault("DATABASE_URL", "sqlite://")
