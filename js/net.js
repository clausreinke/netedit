// bind function this-reference (useful when called from elsewhere)
function bind(f,x) {
  return function() {
    return f.apply(x,arguments);
  };
}

// opera does sequences of style.property=blah setters just fine;
// firefox keeps the properties in the javascript object, 
// but uses only the last one for actual css styling, 
// so we regroup the properties into a single setAttribute
// TODO: what does the standard say?
function patchStyle(x) {
  var s = ['stroke','fill','cursor'].map(function(val){return val+': '+x.style[val];})
                                    .join('; ');
  x.setAttribute('style',s);
}

function Place(net,id,pos) {
  this.net     = net;
  this.id      = id;
  this.pos     = pos;
  this.arcsIn  = [];
  this.arcsOut = [];
  this.addView();
}
Place.prototype.addView = function () {
  // TODO: group node and label, use relative position for latter
  this.p = this.placeShape();
  this.p.id = this.id;
  this.p.place = this;
  this.p.setAttribute('cx',this.pos.x); 
  this.p.setAttribute('cy',this.pos.y); 
  this.p.style.cursor = 'move';
  patchStyle(this.p);
  this.p.addEventListener('click',bind(this.clickHandler,this),false);
  this.p.addEventListener('mousedown',bind(this.mousedownHandler,this),false);
  this.p.addEventListener('mouseup',bind(this.mouseupHandler,this),false);
  this.addLabel(this.pos.x+this.net.r,this.pos.y+this.net.r);
}
Place.prototype.placeShape = function () {
  var shape = document.createElementNS(this.net.svgNS,'circle');
  shape.setAttribute('class','place');
  shape.setAttribute('r',this.net.r);
  shape.style.stroke = 'black';
  shape.style.fill = 'white';
  return shape;
}
Place.prototype.addLabel = function (x,y) {
  this.l = document.createElementNS(this.net.svgNS,'text');
  this.l.setAttribute('class','label');
  this.l.setAttribute('stroke','red');
  this.l.setAttribute('stroke-width','1');
  this.l.setAttribute('font-size','200');
  this.l.setAttribute('x',x);
  this.l.setAttribute('y',y);
  this.l.appendChild(document.createTextNode(this.id));
  this.net.svg.appendChild(this.l);
}
Place.prototype.updateView = function() {
  this.p.id = this.id;
  this.p.setAttribute('cx',this.pos.x); 
  this.p.setAttribute('cy',this.pos.y); 
  this.p.setAttribute('r',this.net.r);
  this.l.setAttribute('x',this.pos.x+this.net.r);
  this.l.setAttribute('y',this.pos.y+this.net.r);
}
Place.prototype.toString = function() {
  return 'Place('+this.id+','+this.pos+')';
}
// nearest point on place border
Place.prototype.connectorFor = function(pos) {
  var vec = this.pos.vectorTo(pos)
  var l   = vec.length();
  return this.pos.add(vec.scale(Net.prototype.r/l));
}
Place.prototype.clickHandler = function(event) {
  message('Place.clickHandler');
  event.stopPropagation(); // avoid net clickHandler
}
Place.prototype.mousedownHandler = function(event) {
  message('Place.mousedownHandler');
  this.p.style.stroke = 'green';
  // redirect whole-svg events 
  // if mouse is faster than rendering, events might not hit small shapes
  this.net.selection = this;
  // need to keep references to dynamically constructed listeners,
  // or removeEventListener wouldn't work
  this.listeners = { 'mousemove' : bind(this.mousemoveHandler,this)
                   , 'mouseup'   : bind(this.mouseupHandler,this)
                   }
  for (var l in this.listeners) 
    this.net.svg.addEventListener(l,this.listeners[l],false);
  event.stopPropagation();
}
Place.prototype.mousemoveHandler = function(event) {
  var p = this.net.client2canvas(event);
  message('Place.mousemoveHandler '+p);
  this.pos = new Pos(p.x,p.y);
  this.updateView();
  for (var ain in this.arcsIn) this.arcsIn[ain].updateView();
  for (var aout in this.arcsOut) this.arcsOut[aout].updateView();
}
Place.prototype.mouseupHandler = function(event) {
  message('Place.mouseupHandler ');
  this.p.style.stroke = 'black';
  this.net.selection = null;
  for (var l in this.listeners) 
    this.net.svg.removeEventListener(l,this.listeners[l],false);
  this.listeners = {};
}
Place.prototype.registerArcAtSource = function(arc) {
  this.arcsOut.push(arc);
}
Place.prototype.registerArcAtTarget = function(arc) {
  this.arcsIn.push(arc);
}

function Transition(net,id,pos) {
  this.net     = net;
  this.id      = id;
  this.pos     = pos;
  this.arcsIn  = [];
  this.arcsOut = [];
  this.addView();
}
Transition.prototype.addView = function () {
  // TODO: group node and label, use relative position for latter
  var x2 = this.pos.x - this.net.transitionWidth/2;
  var y2 = this.pos.y - this.net.transitionHeight/2;
  this.t = document.createElementNS(this.net.svgNS,'rect');
  this.t.setAttribute('class','transition');
  this.t.id = this.id;
  this.t.transition = this;
  this.t.setAttribute('x',x2); 
  this.t.setAttribute('y',y2); 
  this.t.setAttribute('width',this.net.transitionWidth);
  this.t.setAttribute('height',this.net.transitionHeight);
  this.t.style.stroke = 'black';
  this.t.style.fill = 'darkgrey';
  this.t.style.cursor = 'move';
  patchStyle(this.t);
  this.t.addEventListener('click',bind(this.clickHandler,this),false);
  this.t.addEventListener('mousedown',bind(this.mousedownHandler,this),false);
  this.t.addEventListener('mouseup',bind(this.mouseupHandler,this),false);
  this.addLabel(x2+2*this.net.transitionWidth,y2+this.net.transitionHeight);
}
Transition.prototype.addLabel = function (x,y) {
  this.l = document.createElementNS(this.net.svgNS,'text');
  this.l.setAttribute('class','label');
  this.l.setAttribute('stroke','red');
  this.l.setAttribute('stroke-width','1');
  this.l.setAttribute('font-size','200');
  this.l.setAttribute('x',x);
  this.l.setAttribute('y',y);
  this.l.appendChild(document.createTextNode(this.id));
  this.net.svg.appendChild(this.l);
}
Transition.prototype.updateView = function() {
  var x2 = this.pos.x - this.net.transitionWidth/2;
  var y2 = this.pos.y - this.net.transitionHeight/2;
  this.t.id = this.id;
  this.t.setAttribute('x',x2); 
  this.t.setAttribute('y',y2); 
  this.t.setAttribute('width',this.net.transitionWidth);
  this.t.setAttribute('height',this.net.transitionHeight);
  this.l.setAttribute('x',x2+2*this.net.transitionWidth);
  this.l.setAttribute('y',y2+this.net.transitionHeight);
}
Transition.prototype.toString = function() {
  return 'Transition('+this.id+','+this.pos+')';
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
  message('Transition.clickHandler');
  event.stopPropagation(); // avoid net clickHandler
}
Transition.prototype.mousedownHandler = function(event) {
  message('Transition.mousedownHandler');
  this.t.style.stroke = 'green';
  // redirect whole-svg events 
  // if mouse is faster than rendering, events might not hit small shapes
  this.net.selection = this;
  // need to keep references to dynamically constructed listeners,
  // or removeEventListener wouldn't work
  this.listeners = { 'mousemove' : bind(this.mousemoveHandler,this)
                   , 'mouseup'   : bind(this.mouseupHandler,this)
                   }
  for (var l in this.listeners) 
    this.net.svg.addEventListener(l,this.listeners[l],false);
  event.stopPropagation();
}
Transition.prototype.mousemoveHandler = function(event) {
  var p = this.net.client2canvas(event);
  message('Transition.mousemoveHandler '+p);
  this.pos = new Pos(p.x,p.y);
  this.updateView();
  for (var ain in this.arcsIn) this.arcsIn[ain].updateView();
  for (var aout in this.arcsOut) this.arcsOut[aout].updateView();
}
Transition.prototype.mouseupHandler = function(event) {
  message('Transition.mouseupHandler');
  this.t.style.stroke = 'black';
  this.net.selection = null;
  for (var l in this.listeners) 
    this.net.svg.removeEventListener(l,this.listeners[l],false);
  this.listeners = {};
}
Transition.prototype.registerArcAtSource = function(arc) {
  this.arcsOut.push(arc);
}
Transition.prototype.registerArcAtTarget = function(arc) {
  this.arcsIn.push(arc);
}

function Arc(source,target) {
  this.source = source;
  this.target = target;

  this.a = document.createElementNS(this.source.net.svgNS,'path');
  this.a.arc = this;
  this.a.setAttribute('class','arc');
  this.a.addEventListener('click',bind(this.clickHandler,this),false);
  this.updateView();
}
Arc.prototype.updateView = function() {
  var sourceCon = this.source.connectorFor(this.target.pos);
  var targetCon = this.target.connectorFor(this.source.pos);

  this.a.setAttribute('d','M '+sourceCon.x+' '+sourceCon.y
                         +'L '+targetCon.x+' '+targetCon.y);
}
Arc.prototype.toString = function() {
  return this.source+'->'+this.target;
}
Arc.prototype.clickHandler = function(event) {
  message("Arc.clickHandler "+this.source.id+'->'+this.target.id);
}

function Net(id) {

  this.svg = document.createElementNS(this.svgNS,'svg');
  this.svg.id = id;
  this.svg.setAttribute('version','1.1');
  this.svg.setAttribute('width','10cm');
  this.svg.setAttribute('height','10cm');
  this.svg.setAttribute('viewBox','0 0 5000 3000');
  this.svg.style.margin = '10px';

  listProperties('svg.viewBox.baseVal',this.svg.viewBox.baseVal);
  // opera doesn't register mousemove events where there is no svg content,
  // so we provide a dummy backdrop (this doesn't seem needed in firefox?)
  // TODO: does the standard say anything about this?
  this.svgBackdrop = document.createElementNS(this.svgNS,'rect');
    this.svgBackdrop.id = 'transitionCursor';
    this.svgBackdrop.setAttribute('width',5000); // TODO: read svg viewport spec again
    this.svgBackdrop.setAttribute('height',3000);
    this.svgBackdrop.setAttribute('x',0);
    this.svgBackdrop.setAttribute('y',0);
    this.svgBackdrop.setAttribute('style','fill: lightgrey');
    this.svg.appendChild(this.svgBackdrop);

  /* TODO: how to make cursor elements work?..
  this.cursor = document.createElementNS(this.svgNS,'cursor');
  this.cursor.id = 'mycursor';
  this.cursor.setAttribute('xlink:href', 'place.png');
  this.svg.appendChild(this.cursor);
  this.svg.style.cursor = 'url("#mycursor")';
  */

  var defs   = document.createElementNS(this.svgNS,'defs');
  var marker = this.defineMarker();
  defs.appendChild(marker);
  this.svg.appendChild(defs);

  this.cursor      = document.createElementNS(this.svgNS,'g');

    var transitionCursor  = document.createElementNS(this.svgNS,'rect');
    transitionCursor.id = 'transitionCursor';
    transitionCursor.setAttribute('width',this.transitionWidth/5);
    transitionCursor.setAttribute('height',this.transitionHeight/5);
    transitionCursor.setAttribute('x',100-this.transitionWidth/10);
    transitionCursor.setAttribute('y',-100-this.transitionHeight/10);
    transitionCursor.style.stroke  = 'black';
    transitionCursor.style.fill    = 'darkgrey';
    transitionCursor.style.display = 'none';
    this.cursor.appendChild(transitionCursor);

    var placeCursor  = document.createElementNS(this.svgNS,'circle');
    placeCursor.id = 'placeCursor';
    placeCursor.setAttribute('cx',100);
    placeCursor.setAttribute('cy',-100);
    placeCursor.setAttribute('r',this.r/5);
    placeCursor.style.stroke  = 'black';
    placeCursor.style.fill    = 'white';
    placeCursor.style.display = 'none';
    this.cursor.appendChild(placeCursor);

  this.svg.appendChild(this.cursor);

  this.svg.net = this;
  this.clicks = 0;
  this.svg.addEventListener('click',bind(this.clickHandler,this),false);
  this.svg.addEventListener('mousemove',bind(this.mousemoveHandler,this),false);
  document.documentElement.addEventListener('keypress'
                                           ,bind(this.keypressHandler,this)
                                           ,false);

  this.places      = [];
  this.transitions = [];
  this.arcs        = [];
  this.selection   = null;
  this.insertType  = 'p';

  this.help = document.createElement('pre');
  this.help.id = 'netHelp';
  this.help.appendChild(document.createTextNode(
    ['use mouse to drag nodes'
    ,'press "t" and click to add transitions'
    ,'press "p" and click to add places'
    ].join("\n")
    ));

}

Net.prototype.svgNS = 'http://www.w3.org/2000/svg';
Net.prototype.r           = 400;
// TODO: asymmetric transition shape calls for rotation ability
Net.prototype.transitionWidth       = Net.prototype.r/10;
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

Net.prototype.defineMarker = function () {
  var marker = document.createElementNS(this.svgNS,'marker');
  marker.id = "Arrow";
  marker.setAttribute('viewBox','0 0 10 10');
  marker.setAttribute('refX','10');
  marker.setAttribute('refY','5');
  marker.setAttribute('markerUnits','strokeWidth');
  marker.setAttribute('markerWidth','10');
  marker.setAttribute('markerHeight','10');
  marker.setAttribute('orient','auto');
  var path = document.createElementNS(this.svgNS,'path');
  path.setAttribute('d','M 0 0 L 10 5 L 0 10 z');
  marker.appendChild(path);
  return marker;
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
  message('Net.clickHandler '+this.insertType);
  var p = this.client2canvas(event);
  if (this.insertType=='p')
    this.addPlace('CLICK'+this.clicks,p.x,p.y);
  else if (this.insertType=='t')
    this.addTransition('CLICK'+this.clicks,p.x,p.y);
}

Net.prototype.addArc = function (source,target) {
  if ((source instanceof Transition && target instanceof Place)
    ||(source instanceof Place && target instanceof Transition)) {

    var arc = new Arc(source,target);
    this.arcs.push(arc);
    source.registerArcAtSource(arc);
    target.registerArcAtTarget(arc);
    this.svg.appendChild(arc.a);
  }
}

Net.prototype.addPlace = function (id,x,y) {
  var place = new Place(this,id,new Pos(x,y));
  this.places[id] = place;
  this.svg.appendChild(place.p);
  return place;
}

Net.prototype.addTransition = function (id,x,y) {
  var transition = new Transition(this,id,new Pos(x,y));
  this.transitions[id] = transition;
  this.svg.appendChild(transition.t);
  return transition;
}

// seems we can only listen for keys outside svg
// we only set an insertType for use in later click events 
Net.prototype.keypressHandler = function (event) {
  this.insertType = String.fromCharCode(event.keyCode);
  message('Net.keypressHandler '+this.insertType+' '+event.keyCode);
  if (this.insertType==='t') {
    this.cursor.firstChild.style.display = 'inline';
    this.cursor.lastChild.style.display = 'none';
  } else if (this.insertType==='p') {
    this.cursor.firstChild.style.display = 'none';
    this.cursor.lastChild.style.display = 'inline';
  } else {
    this.cursor.firstChild.style.display = 'none';
    this.cursor.lastChild.style.display = 'none';
  }
}

Net.prototype.mousemoveHandler = function (event) {
  var p = this.client2canvas(event);
  message('Net.mousemoveHandler '+p);
  this.cursor.setAttribute('transform','translate('+p.x+','+p.y+')');
}

