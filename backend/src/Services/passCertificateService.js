import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

// Generate Pass Certificate
export const generatePassCertificate = async (monthlyPass) => {
    try {
        // Create a new PDF document
        const pdfDoc = await PDFDocument.create();
        
        // Add a page to the document
        const page = pdfDoc.addPage([600, 800]);
        
        // Get the font
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        // Certificate Design
        const passTypeText = monthlyPass.passType === 'ROUND_TRIP' ? 'ROUND TRIP' : 'ONE WAY';
        const startDate = new Date(monthlyPass.startDate).toLocaleDateString();
        const endDate = new Date(monthlyPass.endDate).toLocaleDateString();
        
        // Background
        page.drawRectangle({
            x: 0,
            y: 0,
            width: 600,
            height: 800,
            color: rgb(0.95, 0.95, 0.95),
        });
        
        // Header Background
        page.drawRectangle({
            x: 0,
            y: 600,
            width: 600,
            height: 200,
            color: rgb(0.2, 0.3, 0.8),
        });
        
        // Title
        page.drawText('DRIVE ME MONTHLY PASS', {
            x: 300,
            y: 720,
            size: 32,
            font: boldFont,
            color: rgb(1, 1, 1),
        });
        
        // Center the title
        const titleWidth = boldFont.widthOfTextAtSize('DRIVE ME MONTHLY PASS', 32);
        page.drawText('DRIVE ME MONTHLY PASS', {
            x: (600 - titleWidth) / 2,
            y: 720,
            size: 32,
            font: boldFont,
            color: rgb(1, 1, 1),
        });
        
        // Pass Type
        page.drawText(passTypeText, {
            x: 300,
            y: 680,
            size: 24,
            font: boldFont,
            color: rgb(1, 1, 1),
        });
        
        // Center the pass type
        const passTypeWidth = boldFont.widthOfTextAtSize(passTypeText, 24);
        page.drawText(passTypeText, {
            x: (600 - passTypeWidth) / 2,
            y: 680,
            size: 24,
            font: boldFont,
            color: rgb(1, 1, 1),
        });
        
        // Main Content Box
        page.drawRectangle({
            x: 50,
            y: 350,
            width: 500,
            height: 200,
            color: rgb(1, 1, 1),
            borderColor: rgb(0.2, 0.3, 0.8),
            borderWidth: 2,
        });
        
        // Passenger Information
        page.drawText('Passenger Information', {
            x: 70,
            y: 520,
            size: 18,
            font: boldFont,
            color: rgb(0.2, 0.3, 0.8),
        });
        
        page.drawText(`Pass ID: ${monthlyPass._id}`, {
            x: 70,
            y: 490,
            size: 14,
            font: font,
            color: rgb(0.3, 0.3, 0.3),
        });
        
        // Route Information
        page.drawText('Route Details', {
            x: 70,
            y: 450,
            size: 18,
            font: boldFont,
            color: rgb(0.2, 0.3, 0.8),
        });
        
        page.drawText(`Route: ${monthlyPass.pickupLocation} to ${monthlyPass.dropoffLocation}`, {
            x: 70,
            y: 420,
            size: 14,
            font: font,
            color: rgb(0.3, 0.3, 0.3),
        });
        
        page.drawText(`Outbound Time: ${monthlyPass.outboundTripTime}`, {
            x: 70,
            y: 390,
            size: 14,
            font: font,
            color: rgb(0.3, 0.3, 0.3),
        });
        
        if (monthlyPass.returnTripTime) {
            page.drawText(`Return Time: ${monthlyPass.returnTripTime}`, {
                x: 70,
                y: 360,
                size: 14,
                font: font,
                color: rgb(0.3, 0.3, 0.3),
            });
        }
        
        // Validity Box
        page.drawRectangle({
            x: 50,
            y: 200,
            width: 500,
            height: 120,
            color: rgb(0.9, 0.95, 1),
            borderColor: rgb(0.2, 0.3, 0.8),
            borderWidth: 2,
        });
        
        page.drawText('Validity Period', {
            x: 70,
            y: 290,
            size: 18,
            font: boldFont,
            color: rgb(0.2, 0.3, 0.8),
        });
        
        page.drawText(`From: ${startDate}`, {
            x: 70,
            y: 260,
            size: 14,
            font: font,
            color: rgb(0.3, 0.3, 0.3),
        });
        
        page.drawText(`To: ${endDate}`, {
            x: 70,
            y: 230,
            size: 14,
            font: font,
            color: rgb(0.3, 0.3, 0.3),
        });
        
        // QR Code Placeholder
        page.drawRectangle({
            x: 420,
            y: 220,
            width: 100,
            height: 100,
            color: rgb(0.8, 0.8, 0.8),
            borderColor: rgb(0.2, 0.3, 0.8),
            borderWidth: 1,
        });
        
        page.drawText('QR CODE', {
            x: 470,
            y: 260,
            size: 10,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
        });
        
        // Center the QR code text
        const qrTextWidth = font.widthOfTextAtSize('QR CODE', 10);
        page.drawText('QR CODE', {
            x: 470 - (qrTextWidth / 2),
            y: 260,
            size: 10,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
        });
        
        // Footer
        page.drawText('This is an official monthly pass certificate.', {
            x: 300,
            y: 100,
            size: 12,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
        });
        
        // Center the footer text
        const footerTextWidth = font.widthOfTextAtSize('This is an official monthly pass certificate.', 12);
        page.drawText('This is an official monthly pass certificate.', {
            x: (600 - footerTextWidth) / 2,
            y: 100,
            size: 12,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
        });
        
        page.drawText('Please present this certificate when boarding.', {
            x: 300,
            y: 80,
            size: 12,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
        });
        
        // Center the second footer text
        const footerTextWidth2 = font.widthOfTextAtSize('Please present this certificate when boarding.', 12);
        page.drawText('Please present this certificate when boarding.', {
            x: (600 - footerTextWidth2) / 2,
            y: 80,
            size: 12,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
        });
        
        page.drawText('For support: support@driveMe.com', {
            x: 300,
            y: 60,
            size: 10,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
        });
        
        // Center the third footer text
        const footerTextWidth3 = font.widthOfTextAtSize('For support: support@driveMe.com', 10);
        page.drawText('For support: support@driveMe.com', {
            x: (600 - footerTextWidth3) / 2,
            y: 60,
            size: 10,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
        });
        
        // Serialize the PDF document
        const pdfBytes = await pdfDoc.save();
        
        // Save the PDF to a file
        const fileName = `monthly-pass-${monthlyPass._id}.pdf`;
        const filePath = path.join(process.cwd(), 'certificates', fileName);
        
        // Create certificates directory if it doesn't exist
        const certDir = path.join(process.cwd(), 'certificates');
        if (!fs.existsSync(certDir)) {
            fs.mkdirSync(certDir, { recursive: true });
        }
        
        // Write the PDF to file
        fs.writeFileSync(filePath, pdfBytes);
        
        console.log(`[v0] Pass certificate generated: ${filePath}`);
        return filePath;
        
    } catch (error) {
        console.error('[v0] Error generating pass certificate:', error);
        throw error;
    }
};

// Generate Pass Summary Report
export const generatePassSummaryReport = async (monthlyPasses) => {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        let yPosition = 700;
        
        // Title
        const page = pdfDoc.addPage([600, 800]);
        page.drawText('MONTHLY PASSES SUMMARY REPORT', {
            x: 300,
            y: yPosition,
            size: 24,
            font: boldFont,
            color: rgb(0.2, 0.3, 0.8),
        });
        
        // Center the title
        const titleWidth = boldFont.widthOfTextAtSize('MONTHLY PASSES SUMMARY REPORT', 24);
        page.drawText('MONTHLY PASSES SUMMARY REPORT', {
            x: (600 - titleWidth) / 2,
            y: yPosition,
            size: 24,
            font: boldFont,
            color: rgb(0.2, 0.3, 0.8),
        });
        
        yPosition -= 50;
        
        // Report Date
        page.drawText(`Generated on: ${new Date().toLocaleDateString()}`, {
            x: 300,
            y: yPosition,
            size: 12,
            font: font,
            color: rgb(0.3, 0.3, 0.3),
        });
        
        // Center the report date
        const dateWidth = font.widthOfTextAtSize(`Generated on: ${new Date().toLocaleDateString()}`, 12);
        page.drawText(`Generated on: ${new Date().toLocaleDateString()}`, {
            x: (600 - dateWidth) / 2,
            y: yPosition,
            size: 12,
            font: font,
            color: rgb(0.3, 0.3, 0.3),
        });
        
        yPosition -= 40;
        
        // Table Headers
        const headers = ['Pass ID', 'Passenger', 'Pass Type', 'Start Date', 'End Date', 'Status'];
        const columnWidths = [80, 120, 80, 80, 80, 80];
        let xPos = 50;
        
        headers.forEach((header, index) => {
            page.drawText(header, {
                x: xPos,
                y: yPosition,
                size: 10,
                font: boldFont,
                color: rgb(1, 1, 1),
            });
            xPos += columnWidths[index];
        });
        
        yPosition -= 20;
        
        // Table Data
        for (const pass of monthlyPasses) {
            xPos = 50;
            const rowData = [
                pass._id.toString().substring(0, 8) + '...',
                pass.passengerId?.name || 'N/A',
                pass.passType,
                new Date(pass.startDate).toLocaleDateString(),
                new Date(pass.endDate).toLocaleDateString(),
                pass.status
            ];
            
            rowData.forEach((data, index) => {
                page.drawText(data.toString(), {
                    x: xPos,
                    y: yPosition,
                    size: 9,
                    font: font,
                    color: rgb(0.3, 0.3, 0.3),
                });
                xPos += columnWidths[index];
            });
            
            yPosition -= 15;
            
            // Add new page if needed
            if (yPosition < 100) {
                pdfDoc.addPage([600, 800]);
                yPosition = 700;
            }
        }
        
        // Save the report
        const pdfBytes = await pdfDoc.save();
        const fileName = `monthly-passes-summary-${Date.now()}.pdf`;
        const filePath = path.join(process.cwd(), 'reports', fileName);
        
        // Create reports directory if it doesn't exist
        const reportsDir = path.join(process.cwd(), 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, pdfBytes);
        
        console.log(`[v0] Pass summary report generated: ${filePath}`);
        return filePath;
        
    } catch (error) {
        console.error('[v0] Error generating pass summary report:', error);
        throw error;
    }
};
