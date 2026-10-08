import pg from "pg";
const {Client}=pg;
const name=process.env.CABO_TEST_DB_USERNAME;
const password=process.env.CABO_TEST_DB_PASSWORD;
if(!name||!password||!/^[a-z][a-z0-9_]{2,40}$/.test(name))throw Error("Missing or invalid isolated test database role configuration");
const client=new Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try{
 const {rows}=await client.query("SELECT current_database() AS db, current_user AS admin");
 const db=rows[0].db;
 const quoted=(s)=>'"'+s.replaceAll('"','""')+'"';
 const existing=await client.query("SELECT 1 FROM pg_roles WHERE rolname=$1",[name]);
 if(!existing.rowCount)await client.query(`CREATE ROLE ${quoted(name)} LOGIN NOINHERIT`);
 await client.query(`ALTER ROLE ${quoted(name)} WITH LOGIN PASSWORD '${password.replaceAll("'","''")}'`);
 await client.query(`GRANT CONNECT ON DATABASE ${quoted(db)} TO ${quoted(name)}`);
 await client.query(`GRANT USAGE ON SCHEMA public TO ${quoted(name)}`);
 await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${quoted(name)}`);
 await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${quoted(name)}`);
 console.log("Isolated read-only PostgreSQL test role configured for database:",db);
}finally{await client.end()}
