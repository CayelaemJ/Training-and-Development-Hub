import {db,admissionInstitutionsTable} from "@workspace/db";
const universityDirectory=[
 ["University of Cape Town","Western Cape","https://www.uct.ac.za"],
 ["University of Pretoria","Gauteng","https://www.up.ac.za"],
 ["University of the Witwatersrand","Gauteng","https://www.wits.ac.za"],
 ["University of Johannesburg","Gauteng","https://www.uj.ac.za"],
 ["University of South Africa","Gauteng","https://www.unisa.ac.za"],
 ["University of KwaZulu-Natal","KwaZulu-Natal","https://www.ukzn.ac.za"],
 ["University of the Free State","Free State","https://www.ufs.ac.za"],
 ["Stellenbosch University","Western Cape","https://www.sun.ac.za"],
 ["Rhodes University","Eastern Cape","https://www.ru.ac.za"],
 ["North-West University","North West","https://www.nwu.ac.za"]
] as const;
/** Directory entries are NOT admissions partnerships. Idempotent test seed, no applicant data. */
async function main(){
 await db.insert(admissionInstitutionsTable).values(universityDirectory.map(([name,province,officialUrl])=>({name,province,officialUrl,route:"handoff",verification:"directory_only"}))).onConflictDoNothing();
 console.log("CABO Apply public-university directory seed completed. Applications are not directly integrated.");
}
main().catch(e=>{console.error(e);process.exitCode=1});
