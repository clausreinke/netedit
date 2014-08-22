process.on('uncaughtException', function(e) {
  console.log(require('util').inspect(e, {showHidden:true}));
})

var url = require('url');
var net = require('selenium-webdriver/net');

var webdriver = require('selenium-webdriver');
var options, driver, SeleniumServer, server, address;
var pathToSeleniumJar = 'C:/javascript/selenium/selenium-server-standalone-2.42.2.jar';

switch(process.argv[2]) {

  case "chrome" :
    console.log("browser: chrome");
    var chrome = require('selenium-webdriver/chrome');

    options = new chrome.Options();
    options.addArguments("--test-type");

    driver = new webdriver.Builder().
                  withCapabilities(options.toCapabilities()).
                  build();

    tests();
    break;

  case "ff" :
    console.log("browser: firefox");
    SeleniumServer = require('selenium-webdriver/remote').SeleniumServer;
    server = new SeleniumServer(pathToSeleniumJar,{port: 4444, loopback: true});

    server.start().then(function(){
      address = url.format({ protocol: 'http'
                           , hostname: net.getLoopbackAddress()
                           , port: 4444
                           , pathname: '/wd/hub'
                           });
      console.log(address);

      driver = new webdriver.Builder().
                    usingServer(address).
                    withCapabilities(webdriver.Capabilities.firefox()).
                    build();

      tests();
    });
    break;

  default:
    console.error("unknown browser");
    process.exit(1);

}

// --------------------------------------------------------------

var report = { success : function() { console.log.apply(null,arguments); }
             , failure : function() { console.error.apply(null,arguments); }
             , test : function(msg,flag) {
                        if (flag) {
                          console.log('. '+msg,flag);
                        } else {
                          console.error('! '+msg,flag);
                        }
                      }
             };

function testElement(root,by) {
  var el = root.findElement(by);
  el.then(function() {
      report.success(". present:",by);
    })
    .then(null,function(){
      report.failure("! missing:",by);
    });
  return el;
}

function testLabel(cls,label,by) {
  var lastElement = driver.findElement(by)
  lastElement.then(function(el){
                    webdriver.promise.all([el.getAttribute('class'),el.getText()])
                      .then(function(ct){
                              if (ct[0]===cls && ct[1]===label)
                                report.success('. present: '+cls+' '+label);
                              else
                                throw ('wrong class '+ct[0]+' or text '+ct[1]);
                            }) })
             .then(null,function(error){report.failure('! missing '+cls+': '+label,error)});
}

function tests() {

var target = 'file://'+__dirname.replace(/\\/g,'/')+'/js/svgtest.html';
console.log("navigating to: ",target);
driver.navigate().to(target);

var body = driver.findElement(webdriver.By.tagName('body'))

// main gui elements
var netDiv = driver.findElement(webdriver.By.id('netDiv'))

testElement(netDiv,webdriver.By.tagName('select'));

var importExportGroup = testElement(netDiv,webdriver.By.id('importExportGroup'));
testElement(importExportGroup,webdriver.By.tagName('form'));
testElement(importExportGroup,webdriver.By.id('exportSVG'));
testElement(importExportGroup,webdriver.By.id('exportPNML'));
testElement(importExportGroup,webdriver.By.id('generateCode'));

var svgDiv = testElement(netDiv,webdriver.By.id('svgDiv'));
var netHelp = testElement(svgDiv,webdriver.By.id('netHelp'));

// help visibility and toggling
// TODO: select help "mode" keeps toggling help while overlaying previous mode
netHelp.isDisplayed().then(function(displayed){
  report.test("help visible:",displayed);
});

body.sendKeys("?").then(function(){
  netHelp.isDisplayed().then(function(displayed){
    report.test("help toggled off by '?':",!displayed);
  });
});

// transition creation mode
body.sendKeys("t").then(function(){
  testElement(svgDiv,webdriver.By.css('svg #cursorPalette #transitionCursor'));

  driver.actions()
        .mouseMove(svgDiv,{x:100,y:100})
        .mouseDown()
        .perform();
  var prompt = driver.switchTo().alert();
  prompt.sendKeys("T0");
  prompt.accept();
  testElement(svgDiv,webdriver.By.css('svg .transition#T0'));
  testLabel('label','T0',webdriver.By.css('svg #contents :nth-last-child(2)'));

  driver.actions()
        .mouseMove(svgDiv,{x:200,y:200})
        .mouseDown()
        .perform();
  var prompt = driver.switchTo().alert();
  prompt.sendKeys("T1");
  prompt.accept();
  testElement(svgDiv,webdriver.By.css('svg .transition#T1'));
  testLabel('label','T1',webdriver.By.css('svg #contents :nth-last-child(2)'));
});

// place creation mode
body.sendKeys("p").then(function(){
  testElement(svgDiv,webdriver.By.css('svg #cursorPalette #placeCursor'));

  driver.actions()
        .mouseMove(svgDiv,{x:200,y:100})
        .mouseDown()
        .perform();
  var prompt = driver.switchTo().alert();
  prompt.sendKeys("P0");
  prompt.accept();
  testElement(svgDiv,webdriver.By.css('svg .place#P0'));
  testLabel('label','P0',webdriver.By.css('svg #contents :nth-last-child(2)'));

  driver.actions()
        .mouseMove(svgDiv,{x:100,y:200})
        .mouseDown()
        .perform();
  var prompt = driver.switchTo().alert();
  prompt.sendKeys("P1");
  prompt.accept();
  testElement(svgDiv,webdriver.By.css('svg .place#P1'));
  testLabel('label','P1',webdriver.By.css('svg #contents :nth-last-child(2)'));
});

// arc creation mode
body.sendKeys("a").then(function(){
  // TODO: no mode cursor?
  //       add label mode?
  //       how to test for individual arcs/midpoints?
  //       geometry tests?

  driver.actions()
        .mouseMove(svgDiv,{x:100,y:100})
        .mouseDown()
        .mouseMove(svgDiv,{x:200,y:100})
        .mouseUp()
        .perform();
  driver.findElements(webdriver.By.css('svg .arc'))
    .then(function(arcs){report.test("created 1 arc: ",arcs.length===1)});

    // add midpoint
    driver.actions()
          .mouseMove(svgDiv,{x:170,y:100})
          .click()
          .perform();

  driver.actions()
        .mouseMove(svgDiv,{x:200,y:100})
        .mouseDown()
        .mouseMove(svgDiv,{x:200,y:200})
        .mouseUp()
        .perform();
  driver.findElements(webdriver.By.css('svg .arc'))
    .then(function(arcs){report.test("created 2 arc: ",arcs.length===2)});

    // add midpoint
    driver.actions()
          .mouseMove(svgDiv,{x:200,y:170})
          .click()
          .perform();

  driver.actions()
        .mouseMove(svgDiv,{x:200,y:200})
        .mouseDown()
        .mouseMove(svgDiv,{x:100,y:200})
        .mouseUp()
        .perform();
  driver.findElements(webdriver.By.css('svg .arc'))
    .then(function(arcs){report.test("created 3 arc: ",arcs.length===3)});

    // add midpoint
    driver.actions()
          .mouseMove(svgDiv,{x:130,y:200})
          .click()
          .perform();

  driver.actions()
        .mouseMove(svgDiv,{x:100,y:200})
        .mouseDown()
        .mouseMove(svgDiv,{x:100,y:100})
        .mouseUp()
        .perform();
  driver.findElements(webdriver.By.css('svg .arc'))
    .then(function(arcs){report.test("created 4 arc: ",arcs.length===4)});

    // add midpoint
    driver.actions()
          .mouseMove(svgDiv,{x:100,y:130})
          .click()
          .perform();

  // arc label creation mode
  body.sendKeys("l").then(function(){
    // TODO: no mode cursor?
    //       add label mode?
    //       geometry tests?

    driver.actions()
          .mouseMove(svgDiv,{x:150,y:100})
          .click()
          .perform();
    var prompt = driver.switchTo().alert();
    prompt.sendKeys("a1");
    prompt.accept();
    testLabel('arclabel','a1',webdriver.By.css('svg #contents :last-child'));

    driver.actions()
          .mouseMove(svgDiv,{x:200,y:150})
          .click()
          .perform();
    var prompt = driver.switchTo().alert();
    prompt.sendKeys("a2");
    prompt.accept();
    testLabel('arclabel','a2',webdriver.By.css('svg #contents :last-child'));

    driver.actions()
          .mouseMove(svgDiv,{x:150,y:200})
          .click()
          .perform();
    var prompt = driver.switchTo().alert();
    prompt.sendKeys("a3");
    prompt.accept();
    testLabel('arclabel','a3',webdriver.By.css('svg #contents :last-child'));

    driver.actions()
          .mouseMove(svgDiv,{x:100,y:150})
          .click()
          .perform();
    var prompt = driver.switchTo().alert();
    prompt.sendKeys("a4");
    prompt.accept();
    testLabel('arclabel','a4',webdriver.By.css('svg #contents :last-child'));

    // move mode
    body.sendKeys("m").then(function(){
      var svg = driver.findElement(webdriver.By.css('svg'));
      svg.getAttribute('style').then(function(style){
        report.test('cursor style is "move":',style==='cursor: move;');
      });

      // TODO: check move outcomes

      // move the nodes
      driver.actions()
            .mouseMove(svgDiv,{x:200,y:100})
            .mouseDown()
            .mouseMove(svgDiv,{x:200,y:150})
            .mouseUp()
            .perform();

      driver.actions()
            .mouseMove(svgDiv,{x:200,y:200})
            .mouseDown()
            .mouseMove(svgDiv,{x:150,y:200})
            .mouseUp()
            .perform();

      driver.actions()
            .mouseMove(svgDiv,{x:100,y:200})
            .mouseDown()
            .mouseMove(svgDiv,{x:100,y:150})
            .mouseUp()
            .perform();

      driver.actions()
            .mouseMove(svgDiv,{x:100,y:100})
            .mouseDown()
            .mouseMove(svgDiv,{x:150,y:100})
            .mouseUp()
            .perform();

      // move arc midpoints
      driver.actions()
            .mouseMove(svgDiv,{x:170,y:100})
            .mouseDown()
            .mouseMove(svgDiv,{x:200,y:100})
            .mouseUp()
            .perform();

      driver.actions()
            .mouseMove(svgDiv,{x:200,y:170})
            .mouseDown()
            .mouseMove(svgDiv,{x:200,y:200})
            .mouseUp()
            .perform();

      driver.actions()
            .mouseMove(svgDiv,{x:130,y:200})
            .mouseDown()
            .mouseMove(svgDiv,{x:100,y:200})
            .mouseUp()
            .perform();

      driver.actions()
            .mouseMove(svgDiv,{x:100,y:130})
            .mouseDown()
            .mouseMove(svgDiv,{x:100,y:100})
            .mouseUp()
            .perform();

/*
      // delete mode
      body.sendKeys("d").then(function(){
        var svg = driver.findElement(webdriver.By.css('svg'));
        svg.getAttribute('style').then(function(style){
          report.test('cursor style is "crosshair":',style==='cursor: crosshair;');
        });

        // delete arc midpoint
        driver.actions()
              .mouseMove(svgDiv,{x:200,y:100})
              .click()
              .perform();

        // delete place
        driver.actions()
              .mouseMove(svgDiv,{x:200,y:150})
              .click()
              .perform();

        // delete transition
        driver.actions()
              .mouseMove(svgDiv,{x:150,y:100})
              .click()
              .perform();
      });
*/
    });
  });
});

// driver.quit();

}
