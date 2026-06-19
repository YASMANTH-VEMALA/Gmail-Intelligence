const rawDate1 = "Thu, 28 May 2026 10:11:14 +0000 (UTC)";
const rawDate2 = "Sat, 23 May 2026 05:06:52 +0530 (IST)";

function parseEmailDate(rawDate) {
  if (!rawDate) return new Date().toISOString();
  
  // Try default JS Date constructor
  let parsed = Date.parse(rawDate);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  
  // Clean up trailing timezone annotations in parentheses, like "(UTC)" or "(IST)"
  const cleanedDate = rawDate.replace(/\s*\([^)]*\)\s*$/, '').trim();
  parsed = Date.parse(cleanedDate);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  
  return new Date().toISOString();
}

console.log('Original 1:', rawDate1);
console.log('Parsed 1:  ', parseEmailDate(rawDate1));

console.log('\nOriginal 2:', rawDate2);
console.log('Parsed 2:  ', parseEmailDate(rawDate2));
