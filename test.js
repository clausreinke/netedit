var webdriver = require('selenium-webdriver');
var chrome = require('selenium-webdriver/chrome');

var options = new chrome.Options();
    options.addArguments("--test-type");

var driver = new webdriver.Builder().
    withCapabilities(options.toCapabilities()).
    build();

function testElement(root,by) {
  var el = root.findElement(by);
  el.then(function() {
      console.log("present:",by);
    })
    .then(null,function(){
      console.error("missing:",by);
    });
  return el;
}

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
  console.log("help visible:",displayed);
});

body.sendKeys("?").then(function(){
  netHelp.isDisplayed().then(function(displayed){
    console.log("help toggled off by '?':",!displayed);
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
  //TODO: how to test text label/content?

  driver.actions()
        .mouseMove(svgDiv,{x:200,y:200})
        .mouseDown()
        .perform();
  var prompt = driver.switchTo().alert();
  prompt.sendKeys("T1");
  prompt.accept();
  testElement(svgDiv,webdriver.By.css('svg .transition#T1'));
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

  driver.actions()
        .mouseMove(svgDiv,{x:100,y:200})
        .mouseDown()
        .perform();
  var prompt = driver.switchTo().alert();
  prompt.sendKeys("P1");
  prompt.accept();
  testElement(svgDiv,webdriver.By.css('svg .place#P1'));
});

// arc creation mode
body.sendKeys("a").then(function(){
  // TODO: no mode cursor?
  //       add label mode?
  //       how to test for individual arcs?
  //       geometry tests?

  driver.actions()
        .mouseMove(svgDiv,{x:100,y:100})
        .mouseDown()
        .mouseMove(svgDiv,{x:200,y:100})
        .mouseUp()
        .perform();
  testElement(svgDiv,webdriver.By.css('svg .arc'));

  driver.actions()
        .mouseMove(svgDiv,{x:200,y:100})
        .mouseDown()
        .mouseMove(svgDiv,{x:200,y:200})
        .mouseUp()
        .perform();
  testElement(svgDiv,webdriver.By.css('svg .arc'));

  driver.actions()
        .mouseMove(svgDiv,{x:200,y:200})
        .mouseDown()
        .mouseMove(svgDiv,{x:100,y:200})
        .mouseUp()
        .perform();
  testElement(svgDiv,webdriver.By.css('svg .arc'));

  driver.actions()
        .mouseMove(svgDiv,{x:100,y:200})
        .mouseDown()
        .mouseMove(svgDiv,{x:100,y:100})
        .mouseUp()
        .perform();
  testElement(svgDiv,webdriver.By.css('svg .arc'));

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
    testElement(svgDiv,webdriver.By.css('svg .arcLabel'));

    driver.actions()
          .mouseMove(svgDiv,{x:200,y:150})
          .click()
          .perform();
    var prompt = driver.switchTo().alert();
    prompt.sendKeys("a2");
    prompt.accept();
    testElement(svgDiv,webdriver.By.css('svg .arcLabel'));

    driver.actions()
          .mouseMove(svgDiv,{x:150,y:200})
          .click()
          .perform();
    var prompt = driver.switchTo().alert();
    prompt.sendKeys("a3");
    prompt.accept();
    testElement(svgDiv,webdriver.By.css('svg .arcLabel'));

    driver.actions()
          .mouseMove(svgDiv,{x:100,y:150})
          .click()
          .perform();
    var prompt = driver.switchTo().alert();
    prompt.sendKeys("a4");
    prompt.accept();
    testElement(svgDiv,webdriver.By.css('svg .arcLabel'));
  });

});

// driver.quit();

