var svgNS = 'http://www.w3.org/2000/svg';

// bind function this-reference (allows us to register model object
// methods as view object event listeners while avoiding explicit
// view->model references)
function bind(f,x) {
  return function() {
    return f.apply(x,arguments);
  };
}

// opera does sequences of style.property=blah setters just fine;
// firefox (mostly) keeps the properties in the javascript object, 
// but uses only the last one set for actual css styling, 
// so we regroup the properties into a single setAttribute
// TODO: we're still sometimes losing style attributes in firefox
//       ('esc' might lose placeCursor attributes, then 'p' gives 
//       black cursor - when this happens, the individual style 
//       attributes of the javascript object are also gone?)
//       ==> try to use object attributes instead of style properties,
//           replacing x.style.prop= with x.setAttributeNS(null,'prop',)
//           where possible
function patchStyle(x) {
  var cssvals = ['cursor','display'];
  var jsvals  = ['cursor','display'];
  var style   = [];
  for (var i in cssvals) {
    var cssval = cssvals[i];
    var jsval  = jsvals[i];
    if (x.style[jsval]) style.push(cssval+': '+x.style[jsval]);
  }
  // listProperties('x.style'+(x.id?'('+x.id+'): ':': '),x.style);
  // message('patchStyle'+(x.id?'('+x.id+'): ':': ')+style.join('; '));
  x.style.cssText = style.join('; ');
}

// TODO: how to make constructor "parameters" net,id,pos explicit?
function Node(nodeType) {
  this.nodeType = nodeType;
}
Node.prototype.addLabel = function (x,y) {
  this.l = document.createElementNS(svgNS,'text');
  this.l.setAttributeNS(null,'class','label');
  this.l.setAttributeNS(null,'stroke','red');
  this.l.setAttributeNS(null,'stroke-width','1');
  this.l.setAttributeNS(null,'font-size','200');
  this.l.setAttributeNS(null,'x',x);
  this.l.setAttributeNS(null,'y',y);
  this.l.appendChild(document.createTextNode(this.id));
  this.l.addEventListener('click',bind(this.rename,this),false);
  this.net.svg.appendChild(this.l);
}
Node.prototype.rename = function(event) {
  var name = prompt('new '+this.nodeType+' name? ',this.id);
  if (name!=null) this.l.firstChild.data = name;
  this.updateView();
}
Node.prototype.toString = function() {
  return this.nodeType+'('+this.id+','+this.pos+')';
}
Node.prototype.mousedownHandler = function(event) {
  // redirect whole-svg events 
  // if mouse is faster than rendering, events might not hit small shapes
  if (this.net.cursor.mode==='m') {
    this.net.selection = this;
    var action = this.mousemoveHandler;
  } else if (this.net.cursor.mode==='a') {
    this.net.selection = new Arc(this,this.net.cursor);
    this.net.selection.a.id = 'partialArc';
    // place the arc just after the backdrop, so it isn't hiding anything
    this.net.svg.insertBefore(this.net.selection.a
                             ,this.net.svg.firstChild.nextSibling);
    var action = this.newArcHandler;
  } else
    return true;
  // need to keep references to dynamically constructed listeners,
  // or removeEventListener wouldn't work
  this.listeners = { 'mousemove' : bind(action,this)
                   , 'mouseup'   : bind(this.mouseupHandler,this)
                   }
  for (var l in this.listeners) 
    this.net.svg.addEventListener(l,this.listeners[l],false);
  return true;
  // event.stopPropagation();
}
Node.prototype.mousemoveHandler = function(event) {
  var p = this.net.client2canvas(event);
  // message(this.nodeType+'.mousemoveHandler '+p);
  this.pos = new Pos(p.x,p.y);
  this.updateView();
  for (var ain in this.arcsIn) this.arcsIn[ain].updateView();
  for (var aout in this.arcsOut) this.arcsOut[aout].updateView();
  return true;
}
Node.prototype.newArcHandler = function(event) {
  var p = this.net.client2canvas(event);
  // message(this.nodeType+'.newArcHandler '+p);
  this.net.selection.updateView();
  return true;
}
Node.prototype.mouseupHandler = function(event) {
  if ((this.net.cursor.mode==='a')
    &&(this.net.selection instanceof Arc)) {
    this.net.svg.removeChild(this.net.selection.a); 
    if (!(this.net.selection.source instanceof this.constructor)) 
      this.net.addArc(this.net.selection.source,this);
  }
  this.net.selection = null;
  for (var l in this.listeners) 
    this.net.svg.removeEventListener(l,this.listeners[l],false);
  this.listeners = {};
  return true;
}
Node.prototype.registerArcAtSource = function(arc) {
  this.arcsOut.push(arc);
}
Node.prototype.registerArcAtTarget = function(arc) {
  this.arcsIn.push(arc);
}
Node.prototype.unregisterArcAtSource = function(arc) {
  delete this.arcsOut[this.arcsOut.indexOf(arc)];
}
Node.prototype.unregisterArcAtTarget = function(arc) {
  delete this.arcsIn[this.arcsIn.indexOf(arc)];
}

function Place(net,id,pos) {
  this.net     = net;
  this.id      = id;
  this.pos     = pos;
  this.arcsIn  = [];
  this.arcsOut = [];
  this.addView();
}
Place.prototype = new Node('place');
Place.prototype.constructor = Place;
Place.prototype.addView = function () {
  // TODO: group node and label, use relative position for latter
  this.p = this.placeShape(this.pos.x,this.pos.y,this.net.r);
  this.p.id = this.id; // TODO: filter/translate to get valid ids only!
  this.p.place = this;
  // this.p.style.cursor = 'move';
  patchStyle(this.p);
  this.p.addEventListener('click',bind(this.clickHandler,this),false);
  this.p.addEventListener('mousedown',bind(this.mousedownHandler,this),false);
  this.p.addEventListener('mouseup',bind(this.mouseupHandler,this),false);
  this.addLabel(this.pos.x+this.net.r,this.pos.y+this.net.r);
}
Place.prototype.placeShape = function (x,y,r) {
  var shape = document.createElementNS(svgNS,'circle');
  shape.setAttributeNS(null,'class','place');
  shape.setAttributeNS(null,'cx',x); 
  shape.setAttributeNS(null,'cy',y); 
  shape.setAttributeNS(null,'r',r);
  shape.setAttributeNS(null,'stroke','black');
  shape.setAttributeNS(null,'strokeWidth','10px');
  shape.setAttributeNS(null,'fill','white');
  return shape;
}
Place.prototype.updateView = function() {
  this.p.id = this.id; // TODO: filter/translate to get valid ids only!
  this.p.setAttributeNS(null,'cx',this.pos.x); 
  this.p.setAttributeNS(null,'cy',this.pos.y); 
  this.p.setAttributeNS(null,'r',this.net.r);
  this.l.setAttributeNS(null,'x',this.pos.x+this.net.r);
  this.l.setAttributeNS(null,'y',this.pos.y+this.net.r);
}
// nearest point on place border
Place.prototype.connectorFor = function(pos) {
  var vec = this.pos.vectorTo(pos)
  var l   = vec.length();
  return this.pos.add(vec.scale(Net.prototype.r/l));
}
Place.prototype.clickHandler = function(event) {
  // message('Place.clickHandler');
  if (this.net.cursor.mode==='d') this.net.removePlace(this);
  return true;
  // event.stopPropagation(); // avoid net clickHandler
}
Place.prototype.mousedownHandler = function(event) {
  // message('Place.mousedownHandler');
  this.p.setAttributeNS(null,'stroke','green');
  Node.prototype.mousedownHandler.call(this,event);
}
Place.prototype.mouseupHandler = function(event) {
  // message('Place.mouseupHandler ');
  this.p.setAttributeNS(null,'stroke','black');
  Node.prototype.mouseupHandler.call(this,event);
}

function Transition(net,id,pos) {
  this.net     = net;
  this.id      = id;
  this.pos     = pos;
  this.arcsIn  = [];
  this.arcsOut = [];
  this.addView();
}
Transition.prototype = new Node('transition');
Transition.prototype.constructor = Transition;
Transition.prototype.addView = function () {
  // TODO: group node and label, use relative position for latter
  this.t = this.transitionShape(this.pos.x,this.pos.y
                               ,this.net.transitionWidth
                               ,this.net.transitionHeight);
  this.t.id = this.id; // TODO: filter/translate to get valid ids only!
  this.t.transition = this;
  // this.t.style.cursor = 'move';
  patchStyle(this.t);
  this.t.addEventListener('click',bind(this.clickHandler,this),false);
  this.t.addEventListener('mousedown',bind(this.mousedownHandler,this),false);
  this.t.addEventListener('mouseup',bind(this.mouseupHandler,this),false);
  this.addLabel(this.pos.x+1.5*this.net.transitionWidth
               ,this.pos.y+0.5*this.net.transitionHeight);
}
Transition.prototype.transitionShape = function (x,y,w,h) {
  var x2 = x - w/2;
  var y2 = y - h/2;
  var t = document.createElementNS(svgNS,'rect');
  t.setAttributeNS(null,'class','transition');
  t.setAttributeNS(null,'x',x2); 
  t.setAttributeNS(null,'y',y2); 
  t.setAttributeNS(null,'width',w);
  t.setAttributeNS(null,'height',h);
  t.setAttributeNS(null,'stroke','black');
  t.setAttributeNS(null,'strokeWidth','10px');
  t.setAttributeNS(null,'fill','darkgrey');
  return t;
}
Transition.prototype.updateView = function() {
  var x2 = this.pos.x - this.net.transitionWidth/2;
  var y2 = this.pos.y - this.net.transitionHeight/2;
  this.t.id = this.id; // TODO: filter/translate to get valid ids only!
  this.t.setAttributeNS(null,'x',x2); 
  this.t.setAttributeNS(null,'y',y2); 
  this.t.setAttributeNS(null,'width',this.net.transitionWidth);
  this.t.setAttributeNS(null,'height',this.net.transitionHeight);
  this.l.setAttributeNS(null,'x',x2+2*this.net.transitionWidth);
  this.l.setAttributeNS(null,'y',y2+this.net.transitionHeight);
}
// nearest point on transition border
// (middle of top,bottom,left,right border)
// TODO: spread out connectors on the sides (need to find a scale
//        that ensures connectors stay within the range of the border)
Transition.prototype.connectorFor = function(pos) {
  var w = Net.prototype.transitionWidth/2;
  var h = Net.prototype.transitionHeight/2;
  var x = this.pos.x;
  var y = this.pos.y;
  return ( pos.x-x > w
         ? new Pos(x+w,y)
         : x-pos.x > w 
           ? new Pos(x-w,y)
           : pos.y > y
             ? new Pos(x,y+h)
             : new Pos(x,y-h));
}
// TODO: slim shapes are hard to hit, perhaps add a transparent halo?
Transition.prototype.clickHandler = function(event) {
  // message('Transition.clickHandler');
  if (this.net.cursor.mode==='d') this.net.removeTransition(this);
  // event.stopPropagation(); // avoid net clickHandler
  return true;
}
Transition.prototype.mousedownHandler = function(event) {
  // message('Transition.mousedownHandler');
  this.t.setAttributeNS(null,'stroke','green');
  Node.prototype.mousedownHandler.call(this,event);
}
Transition.prototype.mouseupHandler = function(event) {
  // message('Transition.mouseupHandler');
  this.t.setAttributeNS(null,'stroke','black');
  Node.prototype.mouseupHandler.call(this,event);
}

function Arc(source,target) {
  this.source = source;
  this.target = target;

  this.a = document.createElementNS(svgNS,'path');
  this.a.arc = this;
  this.a.setAttributeNS(null,'style', 'stroke: black; stroke-width: 10px');
  this.a.setAttributeNS(null,'class','arc');
  this.a.addEventListener('click',bind(this.clickHandler,this),false);
  this.updateView();
}
Arc.prototype.updateView = function() {
  // message('Arc.updateView');
  var sourceCon = this.source.connectorFor(this.target.pos);
  var targetCon = this.target.connectorFor(this.source.pos);

  this.a.setAttributeNS(null,'d','M '+sourceCon.x+' '+sourceCon.y
                         +'L '+targetCon.x+' '+targetCon.y);
}
Arc.prototype.toString = function() {
  return this.source+'->'+this.target;
}
Arc.prototype.clickHandler = function(event) {
  // message("Arc.clickHandler "+this.source.id+'->'+this.target.id);
  if (this.source.net.cursor.mode==='d') this.source.net.removeArc(this);
  return true;
}

function Cursor(net) {
  this.net = net;
  this.pos = new Pos(0,0);

  var tWidth  = this.net.transitionWidth/5;
  var tHeight = this.net.transitionHeight/5;
  var r       = this.net.r/5;

  this.palette = document.createElementNS(svgNS,'g');
  this.mode    = ''; // TODO: an enum would be nicer

  this.transition  = Transition.prototype.transitionShape(100,-100,tWidth,tHeight);
    this.transition.id = 'transitionCursor';
    this.transition.style.display = 'none';
    patchStyle(this.transition);
    this.palette.appendChild(this.transition);

  this.place  = Place.prototype.placeShape(100,-100,r);
    this.place.id = 'placeCursor';
    this.place.style.display = 'none';
    patchStyle(this.place);
    this.palette.appendChild(this.place);
}
// TODO: this patching is getting ridiculous
Cursor.prototype.hideAll = function () {
  this.net.svg.style.cursor = 'auto';
  this.transition.style.display = 'none'; 
  patchStyle(this.transition);
  this.place.style.display = 'none'; 
  patchStyle(this.place);
}
Cursor.prototype.defaultCursor = function () {
  this.hideAll();
}
Cursor.prototype.deleteCursor = function () {
  this.hideAll();
  this.net.svg.style.cursor = 'crosshair';
}
Cursor.prototype.moveCursor = function () {
  this.hideAll();
  this.net.svg.style.cursor = 'move';
}
Cursor.prototype.transitionCursor = function () {
  this.hideAll();
  this.transition.style.display = 'inline';
  patchStyle(this.transition);
}
Cursor.prototype.placeCursor = function () {
  this.hideAll();
  this.place.style.display = 'inline';
  patchStyle(this.place);
}
Cursor.prototype.connectorFor = function(pos) {
  // message('Cursor.connectorFor');
  return this.pos;
}
Cursor.prototype.updatePos = function(p) {
  this.palette.setAttributeNS(null,'transform','translate('+p.x+','+p.y+')');
  // message('Cursor.updatePos');
  this.pos.x = p.x;
  this.pos.y = p.y;
}

function Net(id) {

  this.svg = document.createElementNS(svgNS,'svg');
  this.svg.id = id;
  this.svg.setAttributeNS(null,'version','1.1');
  this.svg.setAttributeNS(null,'width','10cm');
  this.svg.setAttributeNS(null,'height','10cm');
  this.svg.setAttributeNS(null,'viewBox','0 0 5000 3000');
  this.svg.setAttributeNS(null,'clip','0 0 5000 3000'); // TODO: is this right?
  this.svg.style.margin = '10px';

  // opera doesn't register mousemove events where there is no svg content,
  // so we provide a dummy backdrop (this doesn't seem needed in firefox?)
  // TODO: does the standard say anything about this?
  this.addBackdrop();

  this.addDefs();

  this.cursor      = new Cursor(this);
  this.svg.appendChild(this.cursor.palette);

  // TODO: maintain separate groups for places, transitions, arcs, 
  //       and labels, eg, to ensure that all labels overlap all nodes

  this.svg.net = this;
  this.clicks = 0;
  this.svg.addEventListener('click',bind(this.clickHandler,this),false);
  this.svg.addEventListener('mousemove',bind(this.mousemoveHandler,this),false);
  // can't listen for keypress on svg only?
  document.documentElement.addEventListener('keypress'
                                           ,bind(this.keypressHandler,this)
                                           ,false);

  this.places      = [];
  this.transitions = [];
  this.arcs        = [];
  this.selection   = null;

  this.addHelp();
}

Net.prototype.r                     = 400;
// TODO: asymmetric transition shape calls for rotation ability
Net.prototype.transitionWidth       = Net.prototype.r/5;
Net.prototype.transitionHeight      = 2*Net.prototype.r;

Net.prototype.toString = function() {
  var r = '';
  r += this.svg.id+"\n";
  r += "places: ";
  for (var k in this.places) r += '['+k+"="+this.places[k]+']';
  r += "\ntransitions: ";
  for (var k in this.transitions) r += '['+k+"="+this.transitions[k]+']';
  r += "\narcs: ";
  for (var k in this.arcs) r +=  '['+this.arcs[k].source.id
                               +'->'+this.arcs[k].target.id+']';
  return r;
}

Net.prototype.addBackdrop = function () {
  this.svgBackdrop = document.createElementNS(svgNS,'rect');
    this.svgBackdrop.id = 'svgBackdrop';
    // TODO: read svg viewport spec again, viewBox, viewport and aspect..
    //       how to calculate the visible x/y-coordinates automatically?
    this.svgBackdrop.setAttributeNS(null,'width',5000); 
    this.svgBackdrop.setAttributeNS(null,'height',5000);
    this.svgBackdrop.setAttributeNS(null,'x',0);
    this.svgBackdrop.setAttributeNS(null,'y',-1000);
    this.svgBackdrop.setAttributeNS(null,'style','fill: lightgrey');
    this.svg.appendChild(this.svgBackdrop);
}
Net.prototype.addHelp = function () {
  this.help = document.createElementNS(svgNS,'text');
  this.help.setAttributeNS(null,'fill','blue');
  this.help.setAttributeNS(null,'font-size','200');
  this.help.id = 'netHelp';
  var lines = ['press "m" then use mouse to move nodes'
              ,'press "t" then click to add transitions'
              ,'press "p" then click to add places'
              ,'press "a" then drag from node to add arcs'
              ,'press "d" then click to delete nodes or arcs'
              ,'press "?" to toggle this help text'
              ];
  for (var l in lines) {
    var tspan = document.createElementNS(svgNS,'tspan');
    tspan.setAttributeNS(null,'dy','1em');
    tspan.setAttributeNS(null,'x','0em');
    tspan.appendChild(document.createTextNode(lines[l]));
    this.help.appendChild(tspan);
  }
  this.help.style.display = 'none';
  this.svg.appendChild(this.help);
}
Net.prototype.toggleHelp = function() {
  if (this.help.style.display==='none') {
    this.svg.removeChild(this.help);
    this.svg.insertBefore(this.help,null);
    this.help.style.display='inline';
  } else
    this.help.style.display='none';
}
Net.prototype.addDefs = function () {
  var defs   = document.createElementNS(svgNS,'defs');
  var marker = document.createElementNS(svgNS,'marker');

  marker.id = "Arrow";
  marker.setAttributeNS(null,'viewBox','0 0 10 10');
  marker.setAttributeNS(null,'refX','10');
  marker.setAttributeNS(null,'refY','5');
  marker.setAttributeNS(null,'markerUnits','strokeWidth');
  marker.setAttributeNS(null,'markerWidth','10');
  marker.setAttributeNS(null,'markerHeight','10');
  marker.setAttributeNS(null,'orient','auto');
  var path = document.createElementNS(svgNS,'path');
  path.setAttributeNS(null,'d','M 0 0 L 10 5 L 0 10 z');
  marker.appendChild(path);

  defs.appendChild(marker);
  this.svg.appendChild(defs);
}

Net.prototype.client2canvas = function (event) {
  // translate event coordinates to svg coordinates
  // TODO: why is this "screen" vs "client"?
  var ctm = this.svg.getScreenCTM();
  var p = this.svg.createSVGPoint();
  p.x = event.clientX; p.y = event.clientY;
  return p.matrixTransform(ctm.inverse());
}

Net.prototype.clickHandler = function (event) {
  // message('Net.clickHandler '+this.cursor.mode);
  var p = this.client2canvas(event);
  if (this.cursor.mode=='p') {
    var defaultName = 'p'+this.clicks++;
    var name = prompt('name of new place: ',defaultName);
    if (name!=null) this.addPlace(name,p.x,p.y);
  } else if (this.cursor.mode=='t') {
    var defaultName = 't'+this.clicks++;
    var name = prompt('name of new transition: ',defaultName);
    if (name!=null) this.addTransition(name,p.x,p.y)
  }
  return true;
}

Net.prototype.addArc = function (source,target) {
  if ((source instanceof Transition && target instanceof Place)
    ||(source instanceof Place && target instanceof Transition)) {

    var arc = new Arc(source,target);
    this.arcs.push(arc);
    source.registerArcAtSource(arc);
    target.registerArcAtTarget(arc);
    this.svg.appendChild(arc.a);
    return arc;
  }
}
Net.prototype.removeArc = function (arc) {
  delete this.arcs[this.arcs.indexOf(arc)];
  arc.source.unregisterArcAtSource(arc);
  arc.target.unregisterArcAtTarget(arc);
  this.svg.removeChild(arc.a);
}

Net.prototype.addPlace = function (id,x,y) {
  var place = new Place(this,id,new Pos(x,y));
  this.places[id] = place;
  this.svg.appendChild(place.p);
  return place;
}
Net.prototype.removePlace = function (place) {
  delete this.places[place.id];
  for (var arcIn in place.arcsIn) this.removeArc(place.arcsIn[arcIn]);
  for (var arcOut in place.arcsOut) this.removeArc(place.arcsOut[arcOut]);
  this.svg.removeChild(place.p);
  this.svg.removeChild(place.l);
}

Net.prototype.addTransition = function (id,x,y) {
  var transition = new Transition(this,id,new Pos(x,y));
  this.transitions[id] = transition;
  this.svg.appendChild(transition.t);
  return transition;
}
Net.prototype.removeTransition = function (transition) {
  delete this.transitions[transition.id];
  for (var arcIn in transition.arcsIn) this.removeArc(transition.arcsIn[arcIn]);
  for (var arcOut in transition.arcsOut) this.removeArc(transition.arcsOut[arcOut]);
  this.svg.removeChild(transition.t);
  this.svg.removeChild(transition.l);
}

// seems we can only listen for keys outside svg
// we only set a mode for use in later click events 
// TODO: move to Cursor?
Net.prototype.keypressHandler = function (event) {
  // TODO: spec says charCode if printable, keyCode otherwise;
  //       opera 10.10 always seems to use keyCode, firefox follows spec?
  var key = event.charCode || event.keyCode;
  this.cursor.mode = String.fromCharCode(key);
  // message('Net.keypressHandler '+this.cursor.mode+' '+event.charCode+'/'+event.keyCode);
  switch (this.cursor.mode) {
    case 't': this.cursor.transitionCursor(); break;
    case 'p': this.cursor.placeCursor(); break;
    case 'm': this.cursor.moveCursor(); break;
    case 'd': this.cursor.deleteCursor(); break;
    case '?': this.toggleHelp(); break;
    default: this.cursor.defaultCursor();
             // TODO: also need to cancel anything in progress,
             //       such as moves, partial arcs, ..
  }
  // event.preventDefault(); // how to do this only inside svg?
  return true;
}

Net.prototype.mousemoveHandler = function (event) {
  var p = this.client2canvas(event);
  // message('Net.mousemoveHandler '+p.x+'/'+p.y);
  this.cursor.updatePos(p);
  return true;
}

