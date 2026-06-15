import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';

/* ------------------------------------------------------------------ */
/*  Design tokens                                                      */
/* ------------------------------------------------------------------ */
const INK = rgb(0.066, 0.094, 0.153);   // deep navy  #11182a
const INK_SOFT = rgb(0.28, 0.33, 0.41); // slate
const TEAL = rgb(0.078, 0.722, 0.651);  // brand teal #14b8a6
const TEAL_DARK = rgb(0.043, 0.49, 0.45);
const TEAL_TINT = rgb(0.902, 0.976, 0.965);
const PAGE_BG = rgb(0.953, 0.961, 0.969);
const WHITE = rgb(1, 1, 1);
const MUTED = rgb(0.45, 0.49, 0.55);
const LINE = rgb(0.87, 0.89, 0.92);
const SHADOW = rgb(0.86, 0.88, 0.91);
const HEADER_SUB = rgb(0.74, 0.79, 0.85);
const PRICE_LABEL = rgb(0.6, 0.65, 0.72);

/* ------------------------------------------------------------------ */
/*  Drawing helpers                                                    */
/* ------------------------------------------------------------------ */

// Draw text with alignment relative to the given x ('left' | 'center' | 'right').
const txt = (page, str, x, y, size, font, color, align = 'left') => {
    const text = String(str == null ? '' : str);
    let drawX = x;
    if (align === 'center') drawX = x - font.widthOfTextAtSize(text, size) / 2;
    else if (align === 'right') drawX = x - font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: drawX, y, size, font, color });
};

// Truncate text so it fits within maxWidth, adding an ellipsis if needed.
const fit = (str, font, size, maxWidth) => {
    let text = String(str == null ? '' : str);
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
    while (text.length > 1 && font.widthOfTextAtSize(text + '…', size) > maxWidth) {
        text = text.slice(0, -1);
    }
    return text + '…';
};

// Filled (and optionally bordered) rounded rectangle. `top` is the PDF y of the
// rectangle's TOP edge; it extends downward by `height`.
const rrect = (page, x, top, width, height, radius, opts = {}) => {
    const r = Math.min(radius, width / 2, height / 2);
    const w = width, h = height;
    const p = `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
    page.drawSvgPath(p, {
        x,
        y: top,
        color: opts.color,
        borderColor: opts.borderColor,
        borderWidth: opts.borderWidth || 0,
    });
};

// Rounded only on the TOP two corners (bottom edge square).
const rrectTop = (page, x, top, width, height, radius, color) => {
    const r = Math.min(radius, width / 2);
    const w = width, h = height;
    const p = `M 0 ${h} L 0 ${r} Q 0 0 ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h} Z`;
    page.drawSvgPath(p, { x, y: top, color });
};

// Pill / chip. Returns the x position immediately after the chip (for chaining).
const chip = (page, str, x, top, font, { bg, fg, size = 9, padX = 11, h = 20 } = {}) => {
    const w = font.widthOfTextAtSize(str, size) + padX * 2;
    rrect(page, x, top, w, h, h / 2, { color: bg });
    txt(page, str, x + padX, top - (h / 2) - size / 2 + 1.5, size, font, fg);
    return x + w + 8;
};

const fmtDate = (d) => {
    try {
        return new Date(d).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
        });
    } catch {
        return String(d || '');
    }
};

const prettyPaymentMethod = (m) => {
    switch ((m || '').toUpperCase()) {
        case 'STRIPE':
        case 'CARD': return 'Card';
        case 'TAP': return 'Tap Payments';
        case 'CASH': return 'Cash';
        case 'WALLET': return 'Wallet';
        default: return 'Online';
    }
};

/* ------------------------------------------------------------------ */
/*  Generate Pass Certificate (single beautiful page)                  */
/* ------------------------------------------------------------------ */
export const generatePassCertificate = async (monthlyPass, options = {}) => {
    try {
        const pdfDoc = await PDFDocument.create();
        const W = 595, H = 842;                 // A4 portrait
        const page = pdfDoc.addPage([W, H]);

        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        /* ---- Resolve data (works whether or not refs are populated) ---- */
        const isRoundTrip = monthlyPass.passType === 'ROUND_TRIP';
        const passTypeText = isRoundTrip ? 'ROUND TRIP' : 'ONE WAY';
        const passengerName =
            options.passengerName ||
            monthlyPass.passengerId?.name ||
            'Valued Commuter';
        const pickup = monthlyPass.pickupLocation || monthlyPass.routeId?.fromLocation || '—';
        const dropoff = monthlyPass.dropoffLocation || monthlyPass.routeId?.toLocation || '—';
        const currency = monthlyPass.currency || 'AED';
        const totalAmount = Number(monthlyPass.totalAmount || 0);
        const travelDays = Number(monthlyPass.travelDaysCount || monthlyPass.totalTrips || 0);
        const durationMonths = Number(monthlyPass.durationMonths || 1);
        const startFmt = fmtDate(monthlyPass.startDate);
        const endFmt = fmtDate(monthlyPass.endDate);
        const issuedFmt = fmtDate(monthlyPass.createdAt || new Date());
        const passIdStr = String(monthlyPass._id || '');
        const daysRemaining = Math.max(
            0,
            Math.ceil((new Date(monthlyPass.endDate) - new Date()) / (1000 * 60 * 60 * 24))
        );

        /* ---- QR code (real, scannable) ---- */
        const verifyPayload = `https://drivemego.com/pass/verify/${passIdStr}`;
        let qrImage = null;
        try {
            const qrBuffer = await QRCode.toBuffer(verifyPayload, {
                errorCorrectionLevel: 'M',
                margin: 1,
                width: 240,
                color: { dark: '#11182aff', light: '#ffffffff' },
            });
            qrImage = await pdfDoc.embedPng(qrBuffer);
        } catch (qrErr) {
            console.error('[v0] QR generation failed, continuing without QR:', qrErr?.message);
        }

        /* ---- Page background ---- */
        page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAGE_BG });

        /* ---- Card (with subtle shadow) ---- */
        const M = 32;
        const cardX = M;
        const cardW = W - M * 2;          // 531
        const cardTop = H - 24;           // 818
        const cardBottom = 24;
        const cardH = cardTop - cardBottom;
        const R = 18;

        rrect(page, cardX + 4, cardTop - 4, cardW, cardH, R, { color: SHADOW }); // shadow
        rrect(page, cardX, cardTop, cardW, cardH, R, { color: WHITE, borderColor: LINE, borderWidth: 1 });

        /* ---- Header band ---- */
        const headerH = 132;
        const headerTop = cardTop;
        const headerBottom = headerTop - headerH;
        rrectTop(page, cardX, headerTop, cardW, headerH, R, INK);

        txt(page, 'D R I V E M E G O', cardX + 30, headerTop - 40, 10, boldFont, TEAL);
        txt(page, 'MONTHLY PASS', cardX + 30, headerTop - 74, 28, boldFont, WHITE);
        txt(page, 'Official Commuter Travel Pass', cardX + 30, headerTop - 98, 10.5, font, HEADER_SUB);

        // Pass-type pill (top-right)
        const pillText = passTypeText;
        const pillSize = 9.5;
        const pillW = boldFont.widthOfTextAtSize(pillText, pillSize) + 24;
        const pillH = 24;
        const pillX = cardX + cardW - 30 - pillW;
        const pillTop = headerTop - 28;
        rrect(page, pillX, pillTop, pillW, pillH, pillH / 2, { color: TEAL });
        txt(page, pillText, pillX + 12, pillTop - 16, pillSize, boldFont, WHITE);
        txt(page, 'STATUS: ACTIVE', cardX + cardW - 30, headerTop - 70, 8.5, boldFont, HEADER_SUB, 'right');

        /* ---- Journey / Route panel ---- */
        let y = headerBottom - 22;
        const routeH = 120;
        const routeTop = y;
        rrect(page, cardX + 22, routeTop, cardW - 44, routeH, 14, { color: PAGE_BG, borderColor: LINE, borderWidth: 1 });

        const innerLeft = cardX + 44;
        const innerRight = cardX + cardW - 44;
        txt(page, 'JOURNEY', innerLeft, routeTop - 26, 9, boldFont, TEAL);

        // FROM (left) / TO (right)
        txt(page, 'FROM', innerLeft, routeTop - 50, 8, boldFont, MUTED);
        txt(page, fit(pickup, boldFont, 14, 175), innerLeft, routeTop - 69, 14, boldFont, INK);
        txt(page, 'TO', innerRight, routeTop - 50, 8, boldFont, MUTED, 'right');
        txt(page, fit(dropoff, boldFont, 14, 175), innerRight, routeTop - 69, 14, boldFont, INK, 'right');

        // Center connector (dots + dashed line + arrow head)
        const connY = routeTop - 64;
        const cx1 = cardX + cardW * 0.43;
        const cx2 = cardX + cardW * 0.57;
        page.drawEllipse({ x: cx1, y: connY, xScale: 3, yScale: 3, color: TEAL });
        page.drawEllipse({ x: cx2, y: connY, xScale: 3, yScale: 3, color: TEAL });
        page.drawLine({ start: { x: cx1 + 5, y: connY }, end: { x: cx2 - 5, y: connY }, thickness: 1.4, color: TEAL, dashArray: [3, 3] });
        page.drawLine({ start: { x: cx2 - 6, y: connY + 4 }, end: { x: cx2 - 1, y: connY }, thickness: 1.4, color: TEAL });
        page.drawLine({ start: { x: cx2 - 6, y: connY - 4 }, end: { x: cx2 - 1, y: connY }, thickness: 1.4, color: TEAL });

        // Trip-time chips
        const chipTop = routeTop - 100;
        let chipX = innerLeft;
        chipX = chip(page, `Outbound  ${monthlyPass.outboundTripTime || '—'}`, chipX, chipTop, boldFont, { bg: TEAL_TINT, fg: TEAL_DARK });
        if (isRoundTrip && monthlyPass.returnTripTime) {
            chip(page, `Return  ${monthlyPass.returnTripTime}`, chipX, chipTop, boldFont, { bg: TEAL_TINT, fg: TEAL_DARK });
        }

        /* ---- Info stat cards (Passenger / Pass ID / Duration) ---- */
        y = routeTop - routeH - 18;
        const statTop = y;
        const statH = 70;
        const gap = 12;
        const stripW = cardW - 44;
        const statW = (stripW - gap * 2) / 3;
        const stats = [
            { label: 'PASSENGER', value: passengerName },
            { label: 'PASS ID', value: passIdStr.slice(-10).toUpperCase() },
            { label: 'DURATION', value: `${durationMonths} Month${durationMonths > 1 ? 's' : ''}` },
        ];
        stats.forEach((s, i) => {
            const sx = cardX + 22 + i * (statW + gap);
            rrect(page, sx, statTop, statW, statH, 12, { color: WHITE, borderColor: LINE, borderWidth: 1 });
            txt(page, s.label, sx + 12, statTop - 22, 8, boldFont, MUTED);
            txt(page, fit(s.value, boldFont, 12.5, statW - 24), sx + 12, statTop - 44, 12.5, boldFont, INK);
        });

        /* ---- Validity strip ---- */
        y = statTop - statH - 16;
        const valTop = y;
        const valH = 80;
        rrect(page, cardX + 22, valTop, cardW - 44, valH, 14, { color: TEAL_TINT });
        txt(page, 'VALIDITY PERIOD', innerLeft, valTop - 24, 9, boldFont, TEAL_DARK);
        txt(page, `${startFmt}   –   ${endFmt}`, innerLeft, valTop - 50, 16, boldFont, INK);
        txt(page, `${travelDays} travel days covered`, innerLeft, valTop - 68, 9.5, font, INK_SOFT);

        const badgeText = `${daysRemaining} DAYS LEFT`;
        const badgeW = boldFont.widthOfTextAtSize(badgeText, 9) + 24;
        const badgeH = 26;
        const badgeX = cardX + cardW - 44 - badgeW;
        const badgeTop = valTop - 26;
        rrect(page, badgeX, badgeTop, badgeW, badgeH, badgeH / 2, { color: TEAL });
        txt(page, badgeText, badgeX + 12, badgeTop - 17, 9, boldFont, WHITE);

        /* ---- Pricing strip (dark) ---- */
        y = valTop - valH - 16;
        const priceTop = y;
        const priceH = 58;
        rrect(page, cardX + 22, priceTop, cardW - 44, priceH, 12, { color: INK });
        txt(page, 'TOTAL PAID', innerLeft, priceTop - 23, 8.5, boldFont, PRICE_LABEL);
        txt(page, `Monthly Pass  •  ${prettyPaymentMethod(monthlyPass.paymentMethod)}`, innerLeft, priceTop - 42, 11, boldFont, WHITE);
        txt(page, `${currency} ${totalAmount.toFixed(2)}`, innerRight, priceTop - 38, 19, boldFont, TEAL, 'right');

        /* ---- Perforation divider (ticket tear) ---- */
        y = priceTop - priceH - 22;
        const perfY = y;
        page.drawEllipse({ x: cardX, y: perfY, xScale: 9, yScale: 9, color: PAGE_BG });
        page.drawEllipse({ x: cardX + cardW, y: perfY, xScale: 9, yScale: 9, color: PAGE_BG });
        page.drawLine({ start: { x: cardX + 18, y: perfY }, end: { x: cardX + cardW - 18, y: perfY }, thickness: 1.2, color: LINE, dashArray: [4, 4] });

        /* ---- Stub: verification + QR ---- */
        const stubTop = perfY - 24;
        const qrSize = 104;
        const qrX = cardX + cardW - 22 - qrSize;
        const qrYBottom = stubTop - qrSize;
        if (qrImage) {
            page.drawImage(qrImage, { x: qrX, y: qrYBottom, width: qrSize, height: qrSize });
        } else {
            rrect(page, qrX, stubTop, qrSize, qrSize, 8, { color: PAGE_BG, borderColor: LINE, borderWidth: 1 });
        }
        txt(page, 'SCAN TO VERIFY', qrX + qrSize / 2, qrYBottom - 13, 8, boldFont, MUTED, 'center');

        txt(page, 'PASS VERIFICATION', innerLeft, stubTop - 16, 9, boldFont, TEAL);
        txt(page, 'PASS ID', innerLeft, stubTop - 40, 8.5, boldFont, MUTED);
        txt(page, fit(passIdStr, font, 10, qrX - innerLeft - 16), innerLeft, stubTop - 55, 10, font, INK);
        txt(page, 'ISSUED ON', innerLeft, stubTop - 78, 8.5, boldFont, MUTED);
        txt(page, issuedFmt, innerLeft, stubTop - 93, 10, font, INK);

        /* ---- Footer ---- */
        txt(
            page,
            'Present this pass to the operator / driver when boarding.   •   support@drivemego.com',
            W / 2, cardBottom + 22, 9, font, MUTED, 'center'
        );

        /* ---- Save ---- */
        const pdfBytes = await pdfDoc.save();
        const fileName = `monthly-pass-${monthlyPass._id}.pdf`;
        const certDir = path.join(process.cwd(), 'certificates');
        if (!fs.existsSync(certDir)) {
            fs.mkdirSync(certDir, { recursive: true });
        }
        const filePath = path.join(certDir, fileName);
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

        // Title - Centered
        const page = pdfDoc.addPage([600, 800]);
        const titleWidth = boldFont.widthOfTextAtSize('MONTHLY PASSES SUMMARY REPORT', 24);
        page.drawText('MONTHLY PASSES SUMMARY REPORT', {
            x: (600 - titleWidth) / 2,
            y: yPosition,
            size: 24,
            font: boldFont,
            color: rgb(0.2, 0.3, 0.8),
        });

        yPosition -= 50;

        // Report Date - Centered
        const dateText = `Generated on: ${new Date().toLocaleDateString()}`;
        const dateWidth = font.widthOfTextAtSize(dateText, 12);
        page.drawText(dateText, {
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
