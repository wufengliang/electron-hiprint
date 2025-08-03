const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');

// 添加 ReadableStream polyfill
if (typeof globalThis.ReadableStream === 'undefined') {
    const { ReadableStream } = require('stream/web');
    globalThis.ReadableStream = ReadableStream;
}

const app = express();
let browser = null;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false })).use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'assets')));

function getHtml(html) {
    return `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>PDF 生成</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                }
                .content {
                    max-width: 800px;
                    margin: 0 auto;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: #f2f2f2;
                }
            </style>
        </head>
        <body>
            <div class="content">
                ${html}
            </div>
        </body>
        </html>
    `;
}

app.post('/generate-pdf', async (req, res) => {
    try {
        if (!browser) {
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });
        }

        const page = await browser.newPage();
        await page.setContent(getHtml(req.body.html));

        await page.emulateMediaType('print');

        // 生成唯一的文件名
        const timestamp = new Date().getTime();
        const filename = `report_${timestamp}.pdf`;
        const outputPath = path.join(__dirname, 'temp', filename);

        // 确保 temp 目录存在
        if (!fs.existsSync(path.dirname(outputPath))) {
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        }

        const pdf = await page.pdf({
            path: outputPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            }
        });

        // 设置响应头，触发浏览器下载
        res.set({
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Type': 'application/pdf',
            'Content-Length': pdf.length
        });

        // 发送 PDF 数据
        res.send(pdf);

        // 关闭页面，但保持浏览器打开以提高性能
        await page.close();

        console.log(`PDF generated successfully: ${outputPath}`);

    } catch (error) {
        console.log("error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'temp', filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath, filename, (err) => {
            if (err) {
                console.log('Download error:', err);
                res.status(500).json({ error: 'Download failed' });
            }
        });
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'assets/test-puppeteer.html'));
});

const PORT = 10001;
app.listen(PORT, () => {
    console.log(`Puppeteer test server is running at http://127.0.0.1:${PORT}`);
    console.log(`Test page: http://127.0.0.1:${PORT}/test`);
});

// 优雅关闭
process.on('SIGINT', async () => {
    if (browser) {
        await browser.close();
    }
    process.exit(0);
}); 