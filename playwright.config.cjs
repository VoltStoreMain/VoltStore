const {defineConfig,devices}=require('@playwright/test');

module.exports=defineConfig({
  testDir:'./e2e',
  timeout:45000,
  expect:{timeout:12000},
  fullyParallel:true,
  forbidOnly:!!process.env.CI,
  retries:process.env.CI?1:0,
  workers:process.env.CI?2:undefined,
  reporter:[
    ['list'],
    ['html',{outputFolder:'playwright-report',open:'never'}],
    ['junit',{outputFile:'test-results/junit.xml'}]
  ],
  use:{
    baseURL:'http://127.0.0.1:4177',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure',
    locale:'ru-RU',
    timezoneId:'Asia/Almaty'
  },
  projects:[
    {name:'chromium-desktop',use:{...devices['Desktop Chrome'],viewport:{width:1280,height:800}}},
    {name:'android-chromium',use:{...devices['Pixel 7']}},
    {name:'iphone-webkit',use:{...devices['iPhone 13']}}
  ],
  webServer:{
    command:'python3 -m http.server 4177 --bind 127.0.0.1',
    url:'http://127.0.0.1:4177/market.html',
    timeout:30000,
    reuseExistingServer:!process.env.CI
  },
  outputDir:'test-results/artifacts'
});
