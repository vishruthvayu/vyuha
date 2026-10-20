export function parseJSONImport(text:string,limit:number){if(new TextEncoder().encode(text).length>limit)throw new Error('JSON import exceeds file size limit');let value:unknown;try{value=JSON.parse(text);}catch{throw new Error('Invalid JSON import. Choose a valid JSON object using the documented schema.');}if(value===null||typeof value!=='object'||Array.isArray(value))throw new Error('JSON import must be an object');return value;}

// Validate the upload locally but retain its original numeric spelling. Legacy
// signed bundles distinguish Python 1.0 from 1; parsing and re-serializing the
// upload before POST would invalidate an otherwise authentic original file.
export function validatedJSONText(text:string,limit:number){parseJSONImport(text,limit);return text;}
