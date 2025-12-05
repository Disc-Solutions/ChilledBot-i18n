const fs = require('fs');
const path = require('path');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

/**
 * Get all JSON keys recursively from an object
 * @param {object} obj - The object to extract keys from
 * @param {string} prefix - The current path prefix
 * @returns {Set<string>} - Set of all nested keys
 */
function getAllKeys(obj, prefix = '') {
  const keys = new Set();
  
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.add(fullKey);
    
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      const nestedKeys = getAllKeys(obj[key], fullKey);
      nestedKeys.forEach(k => keys.add(k));
    }
  }
  
  return keys;
}

/**
 * Validate JSON syntax by attempting to parse
 * @param {string} filePath - Path to the JSON file
 * @returns {object|null} - Parsed JSON object or null if invalid
 */
function validateJSONSyntax(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`${colors.red}✗ ${filePath}: Invalid JSON syntax${colors.reset}`);
    console.error(`  ${error.message}`);
    return null;
  }
}

/**
 * Compare translation file keys against the reference (en.json)
 * @param {Set<string>} referenceKeys - Keys from en.json
 * @param {Set<string>} translationKeys - Keys from the translation file
 * @param {string} fileName - Name of the translation file
 * @returns {object} - Validation result with missing and extra keys
 */
function compareKeys(referenceKeys, translationKeys, fileName) {
  const missing = [];
  const extra = [];
  
  // Check for missing keys
  referenceKeys.forEach(key => {
    if (!translationKeys.has(key)) {
      missing.push(key);
    }
  });
  
  // Check for extra keys
  translationKeys.forEach(key => {
    if (!referenceKeys.has(key)) {
      extra.push(key);
    }
  });
  
  return { missing, extra };
}

/**
 * Main validation function
 */
function validateTranslations() {
  const repoRoot = path.resolve(__dirname, '../..');
  const referenceFile = path.join(repoRoot, 'en.json');
  
  console.log(`${colors.blue}=== Translation Validation ===${colors.reset}\n`);
  
  // Validate reference file (en.json)
  console.log(`Validating reference file: en.json`);
  const referenceData = validateJSONSyntax(referenceFile);
  
  if (!referenceData) {
    console.error(`${colors.red}ERROR: Reference file (en.json) is invalid!${colors.reset}`);
    process.exit(1);
  }
  
  console.log(`${colors.green}✓ en.json: Valid JSON syntax${colors.reset}\n`);
  
  // Get all keys from reference file
  const referenceKeys = getAllKeys(referenceData);
  console.log(`Reference file contains ${referenceKeys.size} keys\n`);
  
  // Get all JSON files in the repository
  const files = fs.readdirSync(repoRoot)
    .filter(file => file.endsWith('.json') && file !== 'en.json');
  
  let hasErrors = false;
  const results = [];
  
  // Validate each translation file
  for (const file of files) {
    const filePath = path.join(repoRoot, file);
    console.log(`Validating: ${file}`);
    
    // Validate JSON syntax
    const translationData = validateJSONSyntax(filePath);
    
    if (!translationData) {
      hasErrors = true;
      results.push({ file, valid: false, missing: [], extra: [] });
      continue;
    }
    
    console.log(`${colors.green}✓ ${file}: Valid JSON syntax${colors.reset}`);
    
    // Compare keys
    const translationKeys = getAllKeys(translationData);
    const { missing, extra } = compareKeys(referenceKeys, translationKeys, file);
    
    if (missing.length > 0) {
      hasErrors = true;
      console.log(`${colors.red}✗ ${file}: Missing ${missing.length} key(s)${colors.reset}`);
      missing.forEach(key => console.log(`  - ${key}`));
    }
    
    if (extra.length > 0) {
      hasErrors = true;
      console.log(`${colors.yellow}⚠ ${file}: Has ${extra.length} extra key(s) not in en.json${colors.reset}`);
      extra.forEach(key => console.log(`  - ${key}`));
    }
    
    if (missing.length === 0 && extra.length === 0) {
      console.log(`${colors.green}✓ ${file}: All keys match en.json${colors.reset}`);
    }
    
    console.log('');
    results.push({ file, valid: true, missing, extra });
  }
  
  // Summary
  console.log(`${colors.blue}=== Validation Summary ===${colors.reset}`);
  console.log(`Total files validated: ${files.length + 1}`);
  
  const filesWithIssues = results.filter(r => !r.valid || r.missing.length > 0 || r.extra.length > 0);
  
  if (hasErrors) {
    console.log(`${colors.red}Files with issues: ${filesWithIssues.length}${colors.reset}`);
    filesWithIssues.forEach(r => {
      if (!r.valid) {
        console.log(`  - ${r.file}: Invalid JSON`);
      } else if (r.missing.length > 0 || r.extra.length > 0) {
        console.log(`  - ${r.file}: ${r.missing.length} missing, ${r.extra.length} extra keys`);
      }
    });
    console.log('');
    console.log(`${colors.red}Validation FAILED${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`${colors.green}All files valid: ${files.length + 1}${colors.reset}`);
    console.log('');
    console.log(`${colors.green}Validation PASSED${colors.reset}`);
    process.exit(0);
  }
}

// Run validation
validateTranslations();
