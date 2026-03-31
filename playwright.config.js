import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 15000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3999',
    headless: true,
  },
  webServer: {
    command: 'node -e "const h=require(\'http\'),f=require(\'fs\'),p=require(\'path\'),m={html:\'text/html\',css:\'text/css\',js:\'text/javascript\',json:\'application/json\',webmanifest:\'application/manifest+json\',svg:\'image/svg+xml\',png:\'image/png\',ico:\'image/x-icon\',woff2:\'font/woff2\',txt:\'text/plain\'};h.createServer((q,r)=>{let u=q.url===\'/\'?\'/index.html\':q.url,fp=p.join(\'public\',u);f.readFile(fp,(e,d)=>{if(e){r.writeHead(404);r.end();return}let ext=p.extname(fp).slice(1);r.writeHead(200,{\'Content-Type\':m[ext]||\'application/octet-stream\'});r.end(d)})}).listen(3999)"',
    port: 3999,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
