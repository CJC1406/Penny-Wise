"""Back up PersonalFinanceDB and apply additive migrations in order."""
import os
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlparse

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend/.env")
url = urlparse(os.environ["DATABASE_URL"])
if url.scheme not in {"mysql+pymysql", "mysql"}:
    raise SystemExit("DATABASE_URL must use mysql or mysql+pymysql")

env = os.environ.copy()
env["MYSQL_PWD"] = unquote(url.password or "")
host = url.hostname or "127.0.0.1"
port = str(url.port or 3306)
user = unquote(url.username or "")
database = url.path.lstrip("/")
client = ["-h", host, "-P", port, "-u", user, database]
backup = Path(os.environ.get("PENNYWISE_BACKUP", "/private/tmp/pennywise-before-migrations.sql"))
backup.parent.mkdir(parents=True, exist_ok=True)
with backup.open("wb") as output:
    subprocess.run(["mysqldump", "--single-transaction", "--routines", "--triggers", *client], env=env, stdout=output, check=True)

for migration in sorted((ROOT / "database/migrations").glob("*.sql")):
    subprocess.run(["mysql", *client], env=env, input=migration.read_bytes(), check=True)
    print(f"Applied {migration.name}")
print(f"Backup written to {backup}")
