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
  this.p = document.createElementNS(this.net.svgNS,'circle');
  this.p.setAttribute('class','place');
  this.p.id = this.id;
  this.p.place = this;
  this.p.setAttribute('cx',this.pos.x); 
  this.p.setAttribute('cy',this.pos.y); 
  this.p.setAttribute('r',this.net.r);
  this.p.style.stroke = 'black';
  this.p.style.fill = 'white';
  this.p.setAttribute('onclick','this.place.clickHandler(event)');
  this.p.setAttribute('onmousedown','this.place.mousedownHandler(event)');
  this.p.setAttribute('onmouseup','this.place.mouseupHandler(event)');
  this.addLabel(this.pos.x+this.net.r,this.pos.y+this.net.r);
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
  message("clicked "+this.id);
}
Place.prototype.mousedownHandler = function(event) {
  var place = document.getElementById(this.id);
  place.style.stroke = 'green';
  // redirect whole-svg events 
  // if mouse is faster than rendering, events might not hit small shapes
  this.net.selection = this;
  this.net.svg.setAttribute('onmousemove','this.net.selection.mousemoveHandler(event)');
  this.net.svg.setAttribute('onmouseup','this.net.selection.mousemoveHandler(event)');
}
Place.prototype.mousemoveHandler = function(event) {
  var p = this.net.client2canvas(event);
  this.pos = new Pos(p.x,p.y);
  this.updateView();
  for (var ain in this.arcsIn) this.arcsIn[ain].updateView();
  for (var aout in this.arcsOut) this.arcsOut[aout].updateView();
}
Place.prototype.mouseupHandler = function(event) {
  var place = document.getElementById(this.id);
  place.style.stroke = 'black';
  this.net.selection = null;
  this.net.svg.setAttribute('onmousemove','');
  this.net.svg.setAttribute('onmouseup','');
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
  var x2 = this.pos.x - this.net.width/2;
  var y2 = this.pos.y - this.net.height/2;
  this.t = document.createElementNS(this.net.svgNS,'rect');
  this.t.setAttribute('class','transition');
  this.t.id = this.id;
  this.t.transition = this;
  this.t.setAttribute('x',x2); 
  this.t.setAttribute('y',y2); 
  this.t.setAttribute('width',this.net.width);
  this.t.setAttribute('height',this.net.height);
  this.t.style.stroke = 'black';
  this.t.style.fill = 'darkgrey';
  this.t.setAttribute('onclick','this.transition.clickHandler(event)');
  this.t.setAttribute('onmousedown','this.transition.mousedownHandler(event)');
  this.t.setAttribute('onmouseup','this.transition.mouseupHandler(event)');
  this.addLabel(x2+2*this.net.width,y2+this.net.height);
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
  var x2 = this.pos.x - this.net.width/2;
  var y2 = this.pos.y - this.net.height/2;
  this.t.id = this.id;
  this.t.setAttribute('x',x2); 
  this.t.setAttribute('y',y2); 
  this.t.setAttribute('width',this.net.width);
  this.t.setAttribute('height',this.net.height);
  this.l.setAttribute('x',x2+2*this.net.width);
  this.l.setAttribute('y',y2+this.net.height);
}
Transition.prototype.toString = function() {
  return 'Transition('+this.id+','+this.pos+')';
}
// nearest point on transition border
// (middle of top,bottom,left,right border)
// TODO: spread out connectors on the sides (need to find a scale
//        that ensures connectors stay within the range of the border)
Transition.prototype.connectorFor = function(pos) {
  var w = Net.prototype.width/2;
  var h = Net.prototype.height/2;
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
  message('clicked '+this.id);
}
Transition.prototype.mousedownHandler = function(event) {
  var transition = document.getElementById(this.id);
  transition.style.stroke = 'green';
  // redirect whole-svg events 
  // if mouse is faster than rendering, events might not hit small shapes
  this.net.selection = this;
  this.net.svg.setAttribute('onmousemove','this.net.selection.mousemoveHandler(event)');
  this.net.svg.setAttribute('onmouseup','this.net.selection.mousemoveHandler(event)');
}
Transition.prototype.mousemoveHandler = function(event) {
  var p = this.net.client2canvas(event);
  this.pos = new Pos(p.x,p.y);
  this.updateView();
  for (var ain in this.arcsIn) this.arcsIn[ain].updateView();
  for (var aout in this.arcsOut) this.arcsOut[aout].updateView();
}
Transition.prototype.mouseupHandler = function(event) {
  var transition = document.getElementById(this.id);
  transition.style.stroke = 'black';
  this.net.selection = null;
  this.net.svg.setAttribute('onmousemove','');
  this.net.svg.setAttribute('onmouseup','');
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
  this.a.setAttribute('onclick','this.arc.clickHandler(event)');
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
  message("clicked "+this.source.id+'->'+this.target.id);
}

function Net(id) {

  this.svg = document.createElementNS(this.svgNS,'svg');
  this.svg.id = id;
  this.svg.setAttribute('version','1.1');
  this.svg.setAttribute('width','10cm');
  this.svg.setAttribute('height','10cm');
  this.svg.setAttribute('viewBox','0 0 5000 3000');
  this.svg.style.backgroundColor = 'lightgrey';
  this.svg.style.margin = '10px';

  var defs   = document.createElementNS(this.svgNS,'defs');
  var marker = this.defineMarker();
  defs.appendChild(marker);
  this.svg.appendChild(defs);

  this.svg.net = this;
  this.clicks = 0;
  // this.svg.setAttribute('onclick','this.net.clickHandler(event)');
  this.svg.setAttribute('onkeypress','this.net.keypressHandler(event)');
  this.svg.addEventListener('keypress','alert("hi")');

  this.places      = [];
  this.transitions = [];
  this.arcs        = [];
  this.selection   = null;
}

Net.prototype.svgNS = 'http://www.w3.org/2000/svg';
Net.prototype.r           = 400;
// TODO: asymmetric transition shape calls for rotation ability
Net.prototype.width       = Net.prototype.r/10;
Net.prototype.height      = 2*Net.prototype.r;
Net.prototype.toString = function() {
  var r = '';
  r += this.svg.id+"\n";
  r += "places: ";
  for (k in this.places) r += '['+k+"="+this.places[k]+']';
  r += "\ntransitions: ";
  for (k in this.transitions) r += '['+k+"="+this.transitions[k]+']';
  r += "\narcs: ";
  for (k in this.arcs) r +=  '['+this.arcs[k].source.id
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
  this.clicks++;
  var p = this.client2canvas(event);
  if (this.clicks%2===0)
    this.addPlace('CLICK'+this.clicks,p.x,p.y);
  else
    this.addTransition('CLICK'+this.clicks,p.x,p.y);
}

Net.prototype.keypressHandler = function (event) {
  message('keypressHandler ');
  listProperties('event',event);
  var p = this.client2canvas(event);
  this.addPlace('CLICK'+this.clicks,p.x,p.y);
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
