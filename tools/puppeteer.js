if (typeof globalThis.ReadableStream === 'undefined') {
    const { ReadableStream } = require('stream/web');
    globalThis.ReadableStream = ReadableStream;
}

const findChrome = require('carlo/lib/find_chrome');
const express = require('express');
const app = express();
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const os = require('os');


let browser = null;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false })).use(bodyParser.json());


function getHtml(html) {
    return `
        <!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>打印窗口</title>
    <link href="http://127.0.0.1:10000/css/font.css" rel="stylesheet" />
    <link href="http://127.0.0.1:10000/css/hiprint.css" rel="stylesheet" />
    <link href="http://127.0.0.1:10000/css/print-lock.css" rel="stylesheet" />
    <link href="http://127.0.0.1:10000/css/print-lock.css" media="print" rel="stylesheet" />
    <style>
        body {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    </style>
    <script>
        window.$ = window.jQuery = require("jquery");
        $.fn.onImgLoaded = (callback) => {
            let cb = (len) => {
                if (len <= 0) {
                    callback();
                }
            };
            let len = $("img").length;
            cb(len);
            let getUrl = (str) => {
                let reg = /(https?|http|ftp|file):\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]/g;
                let v = str.match(reg);
                if (v && v.length) {
                    return v[0];
                }
                return "";
            };
            $("img").each((i, e) => {
                let $img = $(e);
                let img = new Image();
                let src = $img.attr("src");
                if (!new RegExp("[a-zA-Z]+://[^\s]*").test(src)) {
                    src = getUrl($img.attr("style") || "");
                }
                img.src = src;
                if (img.complete || src == "") {
                    len--;
                    cb(len);
                } else {
                    img.onload = () => {
                        len--;
                        cb(len);
                    };
                    img.onerror = () => {
                        len--;
                        cb(len);
                    };
                }
            });
        };
    </script>
</head>

<body>
    <div id="printElement">
${html}
    </div>
    <script>
    </script>
</body>

</html>
        `
}


app.use(express.static(path.join(__dirname, '../assets')));

app.post('/test', async (req, res) => {
    try {
        if (!browser) {

            const findChromePath = await findChrome({});
            browser = await puppeteer.launch({
                headless: false,
                executablePath: findChromePath.executablePath,
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
        await page.setContent(getHtml(req.body.data.html))
        // const url = path.join(os.tmpdir(), `${Math.random()}.pdf`)
        const url = './test.pdf';
        await page.emulateMediaType('print');
        const pdf = await page.pdf({
            path: url,
            width: '72mm',
            height: '43mm',
        })


        // await browser.close();

        // res.set({ 'Content-Disposition': `attachment;filename=report.pdf`, 'Content-Type': 'application/octet-stream', 'Content-Length': pdf.length });
        // res.send(pdf);

        // 设置响应头，触发浏览器下载
        // 发送 PDF 数据
        res.send(pdf);
    } catch (error) {
        console.log("error:", error);
        res.send(error);
    }
})

app.listen(10000, () => {
    console.log('server is running at http://127.0.0.1:10000');
})