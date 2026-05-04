import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';

/**
 * Utility to convert PDF to Markdown text using pdf-parse
 */
async function convertPdfToMd(pdfPath: string, outputPath?: string) {
    if (!fs.existsSync(pdfPath)) {
        console.error(`❌ File not found: ${pdfPath}`);
        process.exit(1);
    }

    console.log(`⏳ Reading PDF: ${path.basename(pdfPath)}...`);
    
    const dataBuffer = fs.readFileSync(pdfPath);

    try {
        const data = await pdf(dataBuffer);
        
        // Extracted text
        const text = data.text;
        
        // Basic cleanup: remove excessive empty lines
        const cleanedText = text.replace(/\n\s*\n/g, '\n\n');

        const finalOutput = outputPath || pdfPath.replace(/\.[^/.]+$/, "") + ".md";
        
        fs.writeFileSync(finalOutput, cleanedText);
        
        console.log(`✅ Conversion complete!`);
        console.log(`📄 Saved to: ${finalOutput}`);
        console.log(`📊 Pages: ${data.numpages}`);
        console.log(`✨ Info: ${JSON.stringify(data.info, null, 2)}`);
        
    } catch (err: any) {
        console.error(`❌ Error parsing PDF: ${err.message}`);
    }
}

// CLI usage: tsx scripts/pdf-to-md.ts <input.pdf> [output.md]
const args = process.argv.slice(2);
if (args.length < 1) {
    console.log("Usage: npx tsx scripts/pdf-to-md.ts <input.pdf> [output.md]");
} else {
    convertPdfToMd(args[0], args[1]);
}
