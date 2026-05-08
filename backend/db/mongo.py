from pymongo import MongoClient
from config import settings

client = MongoClient(settings.MONGODB_URI)
db = client[settings.MONGODB_DB_NAME]

pipelines_collection = db["pipelines"]
runs_collection = db["runs"]
reports_collection = db["reports"]