function Place(id,pos) {
  this.id   = id;
  this.pos  = pos;
  this.arcs = [];
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
  document.getElementById(this.id).setAttribute("fill","black");
}
Place.prototype.registerArc = function(arc) {
  this.arcs.push(arc);
}

function Transition(id,pos) {
  this.id   = id;
  this.pos  = pos;
  this.arcs = [];
}
Transition.prototype.toString = function() {
  return 'Transition('+this.id+','+this.pos+')';
}
// nearest point on transition border
Transition.prototype.connectorFor = function(pos) {
  var w = Net.prototype.width/2;
  var h = Net.prototype.height;
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
Transition.prototype.clickHandler = function(event) {
  message("clicked "+this.id);
  document.getElementById(this.id).setAttribute("fill","black");
}
Transition.prototype.registerArc = function(arc) {
  this.arcs.push(arc);
}

function Arc(source,target) {
  this.source = source;
  this.target = target;
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
  // this.svg.setAttribute('preserveAspectRatio','none');
  this.svg.style.backgroundColor = 'lightgrey';
  this.svg.style.margin = '10px';

  var defs   = document.createElementNS(this.svgNS,'defs');
  var marker = this.getMarker();
  defs.appendChild(marker);
  this.svg.appendChild(defs);

  this.svg.net = this;
  this.clicks = 0;
  // this.svg.setAttribute('onclick','this.net.clickHandler(event)');
}

Net.prototype.svgNS = 'http://www.w3.org/2000/svg';
Net.prototype.r           = 400;
Net.prototype.width       = Net.prototype.r/10;
Net.prototype.height      = 2*Net.prototype.r;
Net.prototype.places      = [];
Net.prototype.transitions = [];
Net.prototype.arcs        = [];
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

Net.prototype.getMarker = function () {
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

Net.prototype.addLabel = function (id,x,y) {
  var l = document.createElementNS(this.svgNS,'text');
  l.setAttribute('class','label');
  l.setAttribute('stroke','red');
  l.setAttribute('stroke-width','1');
  l.setAttribute('font-size','200');
  l.setAttribute('x',x);
  l.setAttribute('y',y);
  l.appendChild(document.createTextNode(id));
  this.svg.appendChild(l);
}

Net.prototype.addArc = function (source,target) {
  if ((source instanceof Transition && target instanceof Place)
    ||(source instanceof Place && target instanceof Transition)) {

    var arc = new Arc(source,target);
    this.arcs.push(arc);
    source.registerArc(arc);
    target.registerArc(arc);

    var sourceCon = source.connectorFor(target.pos);
    var targetCon = target.connectorFor(source.pos);

    arc.a = document.createElementNS(this.svgNS,'path');
    arc.a.arc = arc;
    arc.a.setAttribute('class','arc');
    arc.a.setAttribute('d','M '+sourceCon.x+' '+sourceCon.y
                        +'L '+targetCon.x+' '+targetCon.y);
    arc.a.setAttribute('onclick','this.arc.clickHandler(event)');

    this.svg.appendChild(arc.a);
  }
}

Net.prototype.addPlace = function (id,x,y) {
  var place = new Place(id,new Pos(x,y));
  this.places[id] = place;
  this.addLabel(id,x+this.r,y+this.r);

  var p = document.createElementNS(this.svgNS,'circle');
  p.setAttribute('class','place');
  p.id = id;
  p.place = place;
  p.setAttribute('cx',x); 
  p.setAttribute('cy',y); 
  p.setAttribute('r',this.r);
  p.style.stroke = 'black';
  p.style.fill = 'white';
  p.setAttribute('onclick','this.place.clickHandler(event)');
  this.svg.appendChild(p);
  
  return place;
}

Net.prototype.addTransition = function (id,x,y) {
  var transition = new Transition(id,new Pos(x,y));
  this.transitions[id] = transition;
  var x2 = x - this.width/2, y2 = y - this.height/2;

  this.addLabel(id,x2+2*this.width,y2+this.height);

  var t = document.createElementNS(this.svgNS,'rect');
  t.setAttribute('class','transition');
  t.id = id;
  t.transition = transition;
  t.setAttribute('x',x2); 
  t.setAttribute('y',y2); 
  t.setAttribute('width',this.width);
  t.setAttribute('height',this.height);
  t.style.stroke = 'black';
  t.style.fill = 'darkgrey';
  t.setAttribute('onclick','this.transition.clickHandler(event)');
  this.svg.appendChild(t);

  return transition;
}
