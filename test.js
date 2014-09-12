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

function testElementDeleted(root,by) {
  var el = root.findElement(by);
  el.then(function() {
      report.failure("! not deleted:",by);
    })
    .then(null,function(){
      report.success(". deleted:",by);
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
  driver.actions().mouseUp().perform(); // ff needs this, chrome doesn't
  testElement(svgDiv,webdriver.By.css('svg .transition#T0'));
  testLabel('label','T0',webdriver.By.css('svg #contents :nth-last-child(2)'));

  driver.actions()
        .mouseMove(svgDiv,{x:200,y:200})
        .mouseDown()
        .perform();
  var prompt = driver.switchTo().alert();
  prompt.sendKeys("T1");
  prompt.accept();
  driver.actions().mouseUp().perform(); // ff needs this, chrome doesn't
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
  driver.actions().mouseUp().perform(); // ff needs this, chrome doesn't
  testElement(svgDiv,webdriver.By.css('svg .place#P0'));
  testLabel('label','P0',webdriver.By.css('svg #contents :nth-last-child(2)'));

  driver.actions()
        .mouseMove(svgDiv,{x:100,y:200})
        .mouseDown()
        .perform();
  var prompt = driver.switchTo().alert();
  prompt.sendKeys("P1");
  prompt.accept();
  driver.actions().mouseUp().perform(); // ff needs this, chrome doesn't
  testElement(svgDiv,webdriver.By.css('svg .place#P1'));
  testLabel('label','P1',webdriver.By.css('svg #contents :nth-last-child(2)'));
});

// arc creation mode
body.sendKeys("a").then(function(){
  // TODO: no mode cursor?
  //       add label mode?
  //       geometry tests?

  function createArc(id,source,target,midpoint) {
    driver.actions()
          .mouseMove(svgDiv,source)
          .mouseDown()
          .mouseMove(svgDiv,target)
          .mouseUp()
          .perform();
    var arc = testElement(svgDiv,webdriver.By.css('svg .arc#'+id));
    arc.getAttribute('d').then(function(path){
      report.test('arc path has source and target:'
                 ,/^M[^ML]*L[^ML]*$/.test(path));
    });

    // add midpoint
    driver.actions()
          .mouseMove(svgDiv,midpoint)
          .mouseDown().mouseUp() // ff needs this instead of click
          //.click()
          .perform();
    arc.getAttribute('d').then(function(path){
      report.test('arc path has source, midpoint and target:'
                 ,/^M[^ML]*L[^ML]*L[^ML]*$/.test(path));
    });
  }

  createArc('arc1',{x:100,y:100},{x:200,y:100},{x:170,y:100});
  createArc('arc3',{x:200,y:100},{x:200,y:200},{x:200,y:170});
  createArc('arc5',{x:200,y:200},{x:100,y:200},{x:130,y:200});
  createArc('arc7',{x:100,y:200},{x:100,y:100},{x:100,y:130});

  // arc label creation mode
  body.sendKeys("l").then(function(){
    // TODO: no mode cursor?
    //       add label mode?
    //       geometry tests?

    function createArcLabel(label,pos) {
      driver.actions()
            .mouseMove(svgDiv,pos)
            .mouseDown().mouseUp() // ff needs this instead of click
            // .click()
            .perform();
      var prompt = driver.switchTo().alert();
      prompt.sendKeys(label);
      prompt.accept();
      testLabel('arclabel',label,webdriver.By.css('svg #contents text:last-of-type'));
    }

    createArcLabel('a1',{x:150,y:100});
    createArcLabel('a2',{x:200,y:150});
    createArcLabel('a3',{x:150,y:200});
    createArcLabel('a4',{x:100,y:150});

    // move mode
    body.sendKeys("m").then(function(){
      var svg = driver.findElement(webdriver.By.css('svg'));
      svg.getAttribute('style').then(function(style){
        report.test('cursor style is "move":',style==='cursor: move;');
      });

      function moveNode(id,x,y,from,to) {
        var node = driver.findElement(webdriver.By.css('#'+id));
        var px,py;
        node.getAttribute(x).then(function(x){px=x});
        node.getAttribute(y).then(function(y){py=y});
        driver.actions()
              .mouseMove(svgDiv,from)
              .mouseDown()
              .mouseMove(svgDiv,to)
              .mouseUp()
              .perform();
        webdriver.promise.all([node.getAttribute(x),node.getAttribute(y)])
          .then(function(xy){report.test('node '+id+' moved:',(px!==xy[0])||(py!==xy[1]))});
      }

      // move the nodes
      moveNode('P0','cx','cy',{x:200,y:100},{x:200,y:150});
      moveNode('T1','x','y',{x:200,y:200},{x:150,y:200});
      moveNode('P1','cx','cy',{x:100,y:200},{x:100,y:150});
      moveNode('T0','x','y',{x:100,y:100},{x:150,y:100});

      function moveArcMidpoint(id,from,to){
        var arc = driver.findElement(webdriver.By.css('svg .arc#'+id));
        var pos;
        arc.getAttribute('d').then(function(path){
          pos = path.match(/^M[^ML]*(L[^ML]*)L[^ML]*$/)[1];
        });
        driver.actions()
              .mouseMove(svgDiv,from)
              .mouseDown()
              .mouseMove(svgDiv,to)
              .mouseUp()
              .perform();
        arc.getAttribute('d').then(function(path){
          report.test('midpoint of arc '+id+' moved:'
                     ,pos !== path.match(/^M[^ML]*(L[^ML]*)L[^ML]*$/)[1]);
        });
      }

      // move arc midpoints
      moveArcMidpoint('arc1',{x:170,y:100},{x:200,y:100});
      moveArcMidpoint('arc3',{x:200,y:170},{x:200,y:200});
      moveArcMidpoint('arc5',{x:130,y:200},{x:100,y:200});
      moveArcMidpoint('arc7',{x:100,y:130},{x:100,y:100});

      // delete mode
      body.sendKeys("d").then(function(){
        var svg = driver.findElement(webdriver.By.css('svg'));
        svg.getAttribute('style').then(function(style){
          report.test('cursor style is "crosshair":',style==='cursor: crosshair;');
        });

        // delete arc midpoint
        driver.actions()
              .mouseMove(svgDiv,{x:200,y:200})
              .mouseDown().mouseUp() // ff needs this instead of click
              // .click()
              .perform();

        var arc = driver.findElement(webdriver.By.css('svg .arc#arc3'));
        arc.getAttribute('d').then(function(path){
          report.test('arc1 path midpoint deleted:'
                     ,/^M[^ML]*L[^ML]*$/.test(path));
        });

        // delete place (and connected arcs)
        driver.actions()
              .mouseMove(svgDiv,{x:100,y:150})
              .mouseDown().mouseUp() // ff needs this instead of click
              // .click()
              .perform();
        testElementDeleted(svgDiv,webdriver.By.css('svg .place#P1'))
        testElementDeleted(svgDiv,webdriver.By.css('svg .arc#arc7'))
        testElementDeleted(svgDiv,webdriver.By.css('svg .arc#arc5'))

        // delete transition (and connected arc)
        driver.actions()
              .mouseMove(svgDiv,{x:150,y:200})
              .mouseDown().mouseUp() // ff needs this instead of click
              // .click()
              .perform();

        testElementDeleted(svgDiv,webdriver.By.css('svg .transition#T1'))
        testElementDeleted(svgDiv,webdriver.By.css('svg .arc#arc3'))

        // TODO: delete arc
        driver.actions()
              .mouseMove(svgDiv,{x:180,y:100})
              .mouseDown().mouseUp() // ff needs this instead of click
              // .click()
              .perform();
        testElementDeleted(svgDiv,webdriver.By.css('svg .arc#arc1'))

      });
    });
  });
});

// driver.quit();

}
