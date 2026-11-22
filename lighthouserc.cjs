module.exports={
  ci:{
    collect:{
      startServerCommand:'node scripts/build-preview.mjs --verify && python3 -u -m http.server 4178 --bind 127.0.0.1 --directory preview',
      startServerReadyPattern:'Serving HTTP on',
      startServerReadyTimeout:15000,
      url:[
        'http://127.0.0.1:4178/market.html',
        'http://127.0.0.1:4178/voltdeal.html?ad=demo-phone-1',
        'http://127.0.0.1:4178/voltguide.html?category=laptop'
      ],
      numberOfRuns:2,
      settings:{
        formFactor:'mobile',
        screenEmulation:{mobile:true,width:390,height:844,deviceScaleFactor:2,disabled:false},
        throttlingMethod:'simulate',
        chromeFlags:'--no-sandbox --disable-dev-shm-usage'
      }
    },
    assert:{
      assertions:{
        'categories:performance':['error',{minScore:0.70}],
        'categories:accessibility':['error',{minScore:0.90}],
        'categories:best-practices':['warn',{minScore:0.75}],
        'categories:seo':['warn',{minScore:0.40}],
        'cumulative-layout-shift':['error',{maxNumericValue:0.25}],
        'largest-contentful-paint':['error',{maxNumericValue:3500}]
      }
    },
    upload:{target:'filesystem',outputDir:'.lighthouseci/reports'}
  }
};
