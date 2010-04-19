var svgNS = 'http://www.w3.org/2000/svg';

// ----------------- simple Petri net editor {{{

// TODO: - add generic net traversal, as well as
//          - static output formats (SVG done, VML missing)
//          - import/export formats (PNML - import partially done)
//       - add token model and view objects
//       - support node resize (what about transition rotation?)
//       - support multipoint arcs
//       - support canvas scaling and scrolling (how does that interact
//          with the dummy background we need for event capture?)
//       - hook up to code generator / simulator
//       - provide api for trace viewing / simulator integration
//       - generalize view handling (generic view objects instead of
//          Place/Transition/Arc-specific .p/.t/.a and .l)
//       - allow default styling to be overridden via css (two issues:
//          1. don't specify local style if applicable style exists
//          2. we currently avoid css-style in favour of svg attributes)
//       - have separate svg groups to add nodes/arcs or labels to,
//         to ensure that all labels overlap all other objects
//       - may need to prevent default event handling (overlap with
//          browser keyboard shortcuts or drag&drop)
//       - command history/undo?
//       - can we reduce the number of explicitly named xml-namespaces 
//         in svg createElementNSs, without running into problems when 
//         manipulating those elements (compare svg/pnml exports)?
//       - this was meant to use modern standards-compliant browsers as
//         portable GUI libraries, so we only support opera and firefox;
//         users will probably ask for other browsers nevertheless - how
//         difficult would it be to support IE8 (VML instead of SVG, other
//         differences/missing features) and possibly Safari/Chrome (only
//         if no special case code needed)
//       - start automating tests prior to release, so that we have a chance
//         of seeing what might be missing when things fail silently with other
//         browsers/versions/oss 

// (SVG only at the moment, works with opera and firefox; might need to add
// VML backend for pre-IE9?)
//
// we have a simple model object hierarchy, with each model object linked to a
// single set of view objects (the view is a simple shadow of the model, so if
// we want to enable multiple views per model object, we could insert an
// interface for registering views with model objects, so that all views
// get updated when the model changes)
//
// Net(id)
//  main object; holds svg element, list of places, transitions, and arcs,
//  as well as current selection, cursor mode, and help text; converts mouse
//  event to svg canvas coordinates; handles adding/removing nodes and arcs
//
// Node(nodeType)
//  common prototype for places and transitions; has text label, can be
//  renamed, moved, deleted, and connected (with other nodes not of the same
//  type); keeps track of incoming and outgoing arcs, position, id, and
//  embedding Net object; subtypes have view objects in addition to text
//  label, can update their view after changes, can calculate where arcs
//  from/to a given position should connect with the view shape
//
//  Place(net,id,pos)
//  Transition(net,id,pos)
//
// Arc(source,target)
//  connects a source and a target node, has view object, can update its
//  view after changes, can be deleted; this is an auxiliary object that
//  mostly just follows whatever happens to the source and target nodes it is
//  registered with
//
// Cursor(net)
//  tracks Net it belongs to, mode of Net-global cursor operation (insert
//  place or transition, connect nodes by arcs, delete nodes, toggle help);
//  has a view that should help to indicate cursor mode
//  
// -------------------------------- }}}

// ----------------------------- auxiliaries {{{

/**
 * bind function 'this'-reference (mostly so that we can register 
 * model object methods as view object event listeners, with
 * 'this' still referring to the model object)
 * NOTE: modern JS-implementations may already have this as a
 *       method (ES5)
 *  
 * @param f
 * @param x
 */
function bind(f,x) {
  return function() {
    return f.apply(x,arguments);
  };
}

// opera does sequences of style.property=blah setters just fine;
// firefox (mostly) keeps the properties in the javascript object, 
// but uses only the last one set for actual css styling, 
// so we regroup the properties into a single setAttribute
//
// TODO: we're still sometimes losing style attributes in firefox
//       ('esc' might lose placeCursor attributes, then 'p' gives 
//       black cursor - when this happens, the individual style 
//       attributes of the javascript object are also gone?)
// ==> we now try to use object attributes instead of style properties,
//     replacing x.style.prop= with x.setAttributeNS(null,'prop',)
//     where possible (eg, where svg attributes overlap css properties)
// TODO: instead of patching after modification, which is ugly and easy to
//       forget provide a patching modification operation (which, for opera,
//       could simply modify the style attributes but, for firefox, needs to
//       do some string munging on cssText..
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

// ----------------------------- }}}

// ----------------------------- Node {{{

// TODO: how to make constructor "parameters" net,id,name,pos explicit?
//       it seems we can only set the Place/Transition prototypes
//       to Node after defining their constructors, when we no longer
//       have their constructor parameters; for now, we simply keep
//       these common parameters in the sub-objects but refer to them
//       in the common methods
/**
 * common prototype for Place/Transition
 *  
 * @param nodeType
 */
function Node(nodeType) {
  this.nodeType = nodeType;
}
Node.prototype.toString = function() {
  return this.nodeType+'('+this.id+','+this.pos+')';
}

// TODO: link font-size to unit-size
/**
 * add a text label
 *  
 * @param x
 * @param y
 */
Node.prototype.addLabel = function (x,y) {
  this.l = document.createElementNS(svgNS,'text');
  this.l.setAttributeNS(null,'class','label');
  this.l.setAttributeNS(null,'stroke','black');
  this.l.setAttributeNS(null,'stroke-width','1px');
  this.l.setAttributeNS(null,'font-size','10');
  this.l.setAttributeNS(null,'x',x);
  this.l.setAttributeNS(null,'y',y);
  this.l.appendChild(document.createTextNode(this.name));
  this.l.addEventListener('click',bind(this.rename,this),false);
  this.net.contents.appendChild(this.l);
}

/**
 * event handler: prompt for new Node name
 *  
 * @param event
 */
Node.prototype.rename = function(event) {
  var name = prompt('new '+this.nodeType+' name? ',this.name);
  if (name!=null) {
    this.l.firstChild.data = name;
    this.name              = name;
  }
  this.updateView();
}

/**
 * event handler: depending on cursor mode, move node or start arc with node as source
 *  
 * @param event
 */
Node.prototype.mousedownHandler = function(event) {
  // redirect whole-svg events 
  // if mouse is faster than rendering, events might otherwise miss small shapes
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
}

/**
 * event handler: update views of node and connected arcs
 *  
 * @param event
 */
Node.prototype.mousemoveHandler = function(event) {
  var p = this.net.client2canvas(event);
  // message(this.nodeType+'.mousemoveHandler '+p);
  this.pos = new Pos(p.x,p.y);
  this.updateView();
  for (var ain in this.arcsIn) this.arcsIn[ain].updateView();
  for (var aout in this.arcsOut) this.arcsOut[aout].updateView();
  return true;
}

/**
 * event handler: update view of partially constructed arc
 *  
 * @param event
 */
Node.prototype.newArcHandler = function(event) {
  // var p = this.net.client2canvas(event);
  // message(this.nodeType+'.newArcHandler '+p);
  this.net.selection.updateView();
  return true;
}

/**
 * event handler: complete partially constructed arc if node is valid target
 *  
 * @param event
 */
Node.prototype.mouseupHandler = function(event) {
  if ((this.net.cursor.mode==='a')
    &&(this.net.selection instanceof Arc)) {
    this.net.contents.removeChild(this.net.selection.a); 
    if (!(this.net.selection.source instanceof this.constructor)) 
      this.net.addArc(this.net.selection.source,this);
  }
  this.net.selection = null;
  for (var l in this.listeners) 
    this.net.svg.removeEventListener(l,this.listeners[l],false);
  this.listeners = {};
  return true;
}

/**
 * register/unregister arc with node
 *  
 * @param arc
 */
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

// ----------------------------- }}}

// ----------------------------- Place {{{

/**
 * a Place is a type of Node, belongs to a net, has an internal id and a
 * user-visible name, as well as a position pos and radius r; it keeps track
 * of incoming and outgoing arcs, and has a view (visible representation) in
 * the host net;
 *  
 * @param net
 * @param id
 * @param name
 * @param pos
 * @param r
 */
function Place(net,id,name,pos,r) {
  this.net     = net;
  this.id      = id;
  this.name    = name;
  this.pos     = pos;
  this.r       = r;
  this.arcsIn  = [];
  this.arcsOut = [];
  this.addView();
}
Place.prototype = new Node('place');
Place.prototype.constructor = Place;

/**
 * a Place is visually represented by a graphical shape and a textual label;
 * it reacts to click, mousedown, and mouseup events;
 */
Place.prototype.addView = function () {
  // TODO: group node and label, use relative position for latter
  this.p = this.placeShape(this.pos.x,this.pos.y,this.r);
  this.p.id = this.id; // TODO: filter/translate to get valid ids only! uniqueness?
  this.p.place = this;
  // this.p.style.cursor = 'move';
  patchStyle(this.p);
  this.p.addEventListener('click',bind(this.clickHandler,this),false);
  this.p.addEventListener('mousedown',bind(this.mousedownHandler,this),false);
  this.p.addEventListener('mouseup',bind(this.mouseupHandler,this),false);
  this.addLabel(this.pos.x+this.r,this.pos.y+this.r);
}

/**
 * the graphical view of a Place is an SVG circle at position x/y with radius r
 *  
 * @param x
 * @param y
 * @param r
 */
Place.prototype.placeShape = function (x,y,r) {
  var shape = document.createElementNS(svgNS,'circle');
  shape.setAttributeNS(null,'class','place');
  shape.setAttributeNS(null,'cx',x); 
  shape.setAttributeNS(null,'cy',y); 
  shape.setAttributeNS(null,'r',r);
  shape.setAttributeNS(null,'stroke','black');
  shape.setAttributeNS(null,'stroke-width','1px');
  shape.setAttributeNS(null,'fill','white');
  return shape;
}

/**
 * update graphical representation following model changes
 */
Place.prototype.updateView = function() {
  this.p.id = this.id; // TODO: filter/translate to get valid ids only!
  this.p.setAttributeNS(null,'cx',this.pos.x); 
  this.p.setAttributeNS(null,'cy',this.pos.y); 
  this.p.setAttributeNS(null,'r',this.r);
  this.l.setAttributeNS(null,'x',this.pos.x+this.r);
  this.l.setAttributeNS(null,'y',this.pos.y+this.r);
}

/**
 * to connect an arc from/to pos to a Place, choose the point on the Place
 * border that is nearest to pos
 *  
 * @param pos
 */
Place.prototype.connectorFor = function(pos) {
  var vec = this.pos.vectorTo(pos)
  var l   = vec.length();
  return this.pos.add(vec.scale(this.r/l));
}

// TODO: can these three handlers move to Node?
//        (need to generalize view handling and removal)
/**
 * event handler: in deletion mode, remove Place from host net
 *  
 * @param event
 */
Place.prototype.clickHandler = function(event) {
  if (this.net.cursor.mode==='d') this.net.removePlace(this);
  return true;
}
/**
 * event handler: visually highlight Place, then delegate to Node
 *  
 * @param event
 */
Place.prototype.mousedownHandler = function(event) {
  this.p.setAttributeNS(null,'stroke','green'); 
    // TODO: - have a 'selected' CSS class for this?
    //       - generically change rendering, move code to Node()
  Node.prototype.mousedownHandler.call(this,event);
}
/**
 * event handler: cancel Place highlighting, then delegate to Node
 *  
 * @param event
 */
Place.prototype.mouseupHandler = function(event) {
  this.p.setAttributeNS(null,'stroke','black');
  Node.prototype.mouseupHandler.call(this,event);
}

// ----------------------------- }}}

// ----------------------------- Transition {{{

/**
 * a Transition is a type of Node, belongs to a net, has an internal id and a
 * user-visible name, as well as a position pos, a width and a height; it keeps
 * track of incoming and outgoing arcs, and has a view (visible representation)
 * in the host net;
 * 
 * @param net
 * @param id
 * @param name
 * @param pos
 * @param width
 * @param height
 */
function Transition(net,id,name,pos,width,height) {
  this.net     = net;
  this.id      = id;
  this.name    = name;
  this.pos     = pos;
  this.width   = width;
  this.height  = height;
  this.arcsIn  = [];
  this.arcsOut = [];
  this.addView();
}
Transition.prototype = new Node('transition');
Transition.prototype.constructor = Transition;

/**
 * a Transition is visually represented by a graphical shape and a textual
 * label; it reacts to click, mousedown, and mouseup events;
 */
Transition.prototype.addView = function () {
  // TODO: group node and label, use relative position for latter
  this.t = this.transitionShape(this.pos.x,this.pos.y,this.width,this.height);
  this.t.id = this.id; // TODO: filter/translate to get valid ids only!
  this.t.transition = this;
  // this.t.style.cursor = 'move';
  patchStyle(this.t);
  this.t.addEventListener('click',bind(this.clickHandler,this),false);
  this.t.addEventListener('mousedown',bind(this.mousedownHandler,this),false);
  this.t.addEventListener('mouseup',bind(this.mouseupHandler,this),false);
  this.addLabel(this.pos.x+0.6*this.width
               ,this.pos.y+0.5*this.height);
}

/**
 * the graphical view of a Transition is an SVG rectangle at position x/y with
 * width w and height h (note that x/y refers to the shape's center position)
 * 
 * @param x
 * @param y
 * @param w
 * @param h
 */
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
  t.setAttributeNS(null,'stroke-width','1px');
  t.setAttributeNS(null,'fill','darkgrey');
  return t;
}

/**
 * update graphical representation following model changes
 */
Transition.prototype.updateView = function() {
  var x2 = this.pos.x - this.width/2;
  var y2 = this.pos.y - this.height/2;
  this.t.id = this.id; // TODO: filter/translate to get valid ids only!
  this.t.setAttributeNS(null,'x',x2); 
  this.t.setAttributeNS(null,'y',y2); 
  this.t.setAttributeNS(null,'width',this.width);
  this.t.setAttributeNS(null,'height',this.height);
  this.l.setAttributeNS(null,'x',x2+2*this.width);
  this.l.setAttributeNS(null,'y',y2+this.height);
}

// TODO: spread out connectors on the sides (need to find a scale
//       that ensures connectors stay within the range of the border)
/**
 * to connect an arc from/to pos to a Transition, choose the point on the
 * Transition border that is nearest to pos; currently approximated as the
 * middle of the nearest side
 * 
 * @param pos
 */
Transition.prototype.connectorFor = function(pos) {
  var w = this.width/2;
  var h = this.height/2;
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

// TODO: can these three handlers move to Node? (very similar to Place handlers)
//        (need to generalize view handling and removal)
// TODO: slim shapes are hard to hit, perhaps add a transparent halo?
/**
 * event handler: in deletion mode, remove Transition from host net
 *  
 * @param event
 */
Transition.prototype.clickHandler = function(event) {
  if (this.net.cursor.mode==='d') this.net.removeTransition(this);
  return true;
}
/**
 * event handler: visually highlight Transition, then delegate to Node
 * 
 * @param event
 */
Transition.prototype.mousedownHandler = function(event) {
  this.t.setAttributeNS(null,'stroke','green');
  Node.prototype.mousedownHandler.call(this,event);
}
/**
 * event handler: cancel Transition highlighting, then delegate to Node
 * 
 * @param event
 */
Transition.prototype.mouseupHandler = function(event) {
  this.t.setAttributeNS(null,'stroke','black');
  Node.prototype.mouseupHandler.call(this,event);
}

// ----------------------------- }}}

// ----------------------------- Arc {{{

/**
 * an Arc connects a source and a target node (of differing types); it has a
 * view (visible representation) in the nodes' host net
 * 
 * @param source
 * @param target
 */
function Arc(source,target) {
  this.source = source;
  this.target = target;

  this.addView();
  this.updateView();
}
Arc.prototype.toString = function() {
  return this.source+'->'+this.target;
}

/**
 * an Arc is visually represented by graphical view (an SVG path); it reacts to
 * click events
 */
Arc.prototype.addView = function() {
  this.a = document.createElementNS(svgNS,'path');
  this.a.arc = this;
  this.a.setAttributeNS(null,'style', 'stroke: black; stroke-width: 1px');
  this.a.setAttributeNS(null,'class','arc');
  this.a.setAttributeNS(null,'marker-end','url(#Arrow)');
  this.a.addEventListener('click',bind(this.clickHandler,this),false);
}

/**
 * update graphical representation following model changes 
 */
Arc.prototype.updateView = function() {
  var sourceCon = this.source.connectorFor(this.target.pos);
  var targetCon = this.target.connectorFor(this.source.pos);

  this.a.setAttributeNS(null,'d','M '+sourceCon.x+' '+sourceCon.y
                         +'L '+targetCon.x+' '+targetCon.y);
}

/**
 * event handler: in deletion mode, remove Arc from host net
 * 
 * @param event
 */
Arc.prototype.clickHandler = function(event) {
  // message("Arc.clickHandler "+this.source.id+'->'+this.target.id);
  if (this.source.net.cursor.mode==='d') this.source.net.removeArc(this);
  return true;
}

// ----------------------------- }}}

// ----------------------------- Cursor {{{

/**
 * a Cursor belongs to a host net; it tracks and visualizes a Cursor mode, which
 * determines mode-specific event handler actions in that net (such as
 * creating/moving/deleting Nodes/Arcs); (note: we use predefined CSS cursor
 * shapes, where that makes sense, but render SVG shapes for cursor mode
 * visualization directly instead of going via the official cursor element)
 * 
 * @param net
 */
function Cursor(net) {
  this.net = net;
  this.pos = new Pos(0,0);

  var tWidth  = this.net.transitionWidth/5;
  var tHeight = this.net.transitionHeight/5;
  var r       = this.net.r/5;
  var offset  = this.net.r;

  // TODO: instead of hiding the various cursor shapes in the
  //       palette group, keep off-screen references and simply
  //       assign the active shape to the palette?
  this.palette = document.createElementNS(svgNS,'g');
  this.palette.id = 'cursorPalette';
  this.mode    = ''; // TODO: - an enum would be nicer
                     //       - can we replace the various switch/if on
                     //         mode with a nice oo pattern without
                     //         obfuscating the code?

  this.transition  = Transition.prototype.transitionShape(offset,-offset,tWidth,tHeight);
    this.transition.id = 'transitionCursor';
    this.transition.style.display = 'none';
    patchStyle(this.transition);
    this.palette.appendChild(this.transition);

  this.place  = Place.prototype.placeShape(offset,-offset,r);
    this.place.id = 'placeCursor';
    this.place.style.display = 'none';
    patchStyle(this.place);
    this.palette.appendChild(this.place);
}

// TODO: this patching is getting ridiculous
/**
 * hide all Cursor shapes
 */
Cursor.prototype.hideAll = function () {
  this.net.svg.style.cursor = 'auto';
  this.transition.style.display = 'none'; 
  patchStyle(this.transition);
  this.place.style.display = 'none'; 
  patchStyle(this.place);
}

/**
 * set 'default' Cursor
 */
Cursor.prototype.defaultCursor = function () {
  this.hideAll();
}

/**
 * set 'delete' Cursor, to delete elements
 */
Cursor.prototype.deleteCursor = function () {
  this.hideAll();
  this.net.svg.style.cursor = 'crosshair';
}

/**
 * set 'move' Cursor, to move elements
 */
Cursor.prototype.moveCursor = function () {
  this.hideAll();
  this.net.svg.style.cursor = 'move';
}

/**
 * set 'transition' Cursor, to create Transitions
 */
Cursor.prototype.transitionCursor = function () {
  this.hideAll();
  this.transition.style.display = 'inline';
  patchStyle(this.transition);
}

/**
 * set 'place' Cursor, to create Places
 */
Cursor.prototype.placeCursor = function () {
  this.hideAll();
  this.place.style.display = 'inline';
  patchStyle(this.place);
}

/**
 * Cursor supports connectorFor interface, so that partially constructed arcs
 * can simply be connected to the Cursor while under construction
 * 
 * @param pos
 */
Cursor.prototype.connectorFor = function(pos) {
  return this.pos;
}

/**
 * update the Cursor position (usually called from mousemove handler)
 * 
 * @param p
 */
Cursor.prototype.updatePos = function(p) {
  this.palette.setAttributeNS(null,'transform','translate('+p.x+','+p.y+')');
  this.pos.x = p.x;
  this.pos.y = p.y;
}

// ----------------------------- }}}

// ----------------------------- Net {{{

/**
 * a Net has an id, an SVG rendering (with viewBox dimensions width and height);
 * it has lists of transitions, places and arcs, as well as a current selection;
 * its view is grouped into "real" contents (the transition, place, and arc
 * views) and "extra" stuff (backdrop, definitions, cursor, help text); it
 * reacts to click, mousemove, and keypress events (the latter are currently
 * captured at the surrounding document level)
 * 
 * @param id
 * @param width
 * @param height
 */
function Net(id,width,height) { // viewspace dimensions

  this.id     = id;
  this.svg    = document.createElementNS(svgNS,'svg');
  this.svg.id = id;
  this.svg.setAttributeNS(null,'version','1.1');
  this.svg.setAttributeNS(null,'width','90%');
  this.svg.setAttributeNS(null,'height','10cm');
  this.svg.style.margin = '10px';

  // opera doesn't register mousemove events where there is no svg content,
  // so we provide a dummy backdrop (this doesn't seem needed in firefox?)
  // TODO: does the standard say anything about this?
  this.addBackdrop();

  this.setViewSize(0,0,width,height);

  this.addDefs();

  this.cursor      = new Cursor(this);
  this.svg.appendChild(this.cursor.palette);

  // put "real" contents such as nodes and arcs into their own group, to keep
  // them separate from administrative stuff such as backdrop, cursor, defs
  // (also helps with computing bounding boxes)
  this.contents = document.createElementNS(svgNS,'g');
  this.contents.id = 'contents';
  this.svg.appendChild(this.contents);

  // TODO: maintain separate groups for places/transitions/arcs and labels, eg,
  //       to ensure that all labels overlap all other elements

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
Net.prototype.toString = function() {
  var r = '';
  r += this.id+"\n";
  r += "places: ";
  for (var k in this.places) r += '['+k+"="+this.places[k]+']';
  r += "\ntransitions: ";
  for (var k in this.transitions) r += '['+k+"="+this.transitions[k]+']';
  r += "\narcs: ";
  for (var k in this.arcs) r +=  '['+this.arcs[k].source.id
                               +'->'+this.arcs[k].target.id+']';
  return r;
}

// TODO: asymmetric transition shape would be preferred, to avoid
//        impressions of duration, but that calls for rotation ability
/**
 * default node dimensions 
 */
Net.prototype.r                     = 10;
Net.prototype.transitionWidth       = 2*Net.prototype.r;
Net.prototype.transitionHeight      = 2*Net.prototype.r;

/**
 * render Net as PNML document string
 */
Net.prototype.toPNML = function() {
  // every XML file comes down to XML elements
  var element = function(tag,attributes,children) {
                   var e = document.createElementNS(null,tag);
                   for (var a in attributes) e.setAttribute(a,attributes[a]);
                   for (var c in children) e.appendChild(children[c]);
                   return e;
                }
  // auxiliary definitions for PNML format elements
  var dimension = function(x,y) { return element('dimension',{'x':x,'y':y}); }
  var position  = function(x,y) { return element('position',{'x':x,'y':y}); }
  var graphics  = function(children) { return element('graphics',{},children); }
  var name = function(text) {
              return element('name',{}
                            ,[element('text',{},[document.createTextNode(text)])]);
             }
  var place      = function(id,n,x,y) {
                     return element('place',{'id':id},[name(n),graphics([position(x,y)])]);
                   }
  var transition = function(id,n,x,y) {
                    return element('transition',{'id':id},[name(n),graphics([position(x,y)])]);
                   }
  var arc = function(id,source,target) {
             return element('arc',{'id':id,'source':source,'target':target});
            }
  var net = function(type,id,children) {
              return element('net',{'type':type,'id':id},children);
            }

  // start building: places, transitions, arcs, then the full net
  var ps = []; 
    for(var pi in this.places) {
      var p=this.places[pi];
      ps.push(place(p.id,p.name,p.pos.x,p.pos.y));
    };
  var ts = [];
    for(var ti in this.transitions) {
      var t=this.transitions[ti];
      ts.push(transition(t.id,t.name,t.pos.x,t.pos.y));
    };
  var as = [];
    for(var ai in this.arcs) {
      var a=this.arcs[ai];
      as.push(arc('arc'+ai,a.source.id,a.target.id));
    };
  var n = net("http://www.pnml.org/version-2009/grammar/ptnet",'net'
             ,[name('example')
              ,graphics([dimension(this.width,this.height)
                        ,position(0,0)])
              ].concat(ts,ps,as));

  // embed the net in a PNML document, return its XML rendering
  var pnml = document.implementation.createDocument("http://www.pnml.org/version-2009/grammar/pnml",'pnml',null);
  pnml.documentElement.appendChild(n);

  return listXML('',pnml.documentElement).join("\n");
}

/**
 * extract some Net data (dimensions, places, transitions, arcs, node names and
 * positions) from PNML document string pnml; coordinates can optionally be
 * scaled, node dimension units can optionally be changed from default;
 * (note: this isn't a complete parse, and PNML files do not always contain all
 * the information needed to reproduce a view unambiguosly)
 * 
 * @param pnml
 * @param scale
 * @param unit
 */
Net.prototype.fromPNML = function(pnml,scale,unit) {
  if (pnml.querySelectorAll) {
    // if the standard specifies any default scale/unit at all, not all PNML
    // files use those
    var scale = scale ? scale : 1; 
    var unit  = unit ? unit : 10; 
    // first, try to extract viewBox dimensions
    var d = pnml.querySelector('net>graphics>dimension');
    var p = pnml.querySelector('net>graphics>position');
    var px = p ? p.attributes['x'].nodeValue : '0';
    var py = p ? p.attributes['y'].nodeValue : '0';
    var dx = d ? d.attributes['x'].nodeValue : '1000';
    var dy = d ? d.attributes['y'].nodeValue : '1000';
    this.setViewSize(px,py,dx,dy);
    message('**'+p+'|'+d+' : '+px+' '+py+' '+dx+' '+dy);
    // if dimensions are missing, we'll try to estimate them
    // (we keep track of max node coordinates)
    if (!d) { dx = 0; dy = 0; } 

    // extract minimal info about places (name, position), transitions (name,
    // position) and arcs (source, target), add corresponding elements to Net
    var places = pnml.querySelectorAll('place');
    for (var i=0; i<places.length; i++) {
      var place = places[i];
      var id    = place.getAttributeNS(null,'id');
      var name  = place.querySelector('name>text');
      var pos   = place.querySelector('graphics>position');
      var x     = pos.attributes['x'].nodeValue;
      var y     = pos.attributes['y'].nodeValue;
      px = Math.min(px,x); dx = Math.max(dx,x);
      py = Math.min(py,y); dy = Math.max(dy,y);
      // message(id+': '+(name?name.textContent:'')+' '+x+'/'+y);
      this.addPlace(id,x*scale,y*scale,unit,name?name.textContent:null);
    }

    var transitions = pnml.querySelectorAll('transition');
    for (var i=0; i<transitions.length; i++) {
      var transition = transitions[i];
      var id    = transition.getAttributeNS(null,'id');
      var name  = transition.querySelector('name>text');
      var pos   = transition.querySelector('graphics>position');
      var x     = pos.attributes['x'].nodeValue;
      var y     = pos.attributes['y'].nodeValue;
      px = Math.min(px,x); dx = Math.max(dx,x);
      py = Math.min(py,y); dy = Math.max(dy,y);
      // message(id+': '+(name?name.textContent:'')+' '+x+'/'+y);
      this.addTransition(id,x*scale,y*scale,2*unit,2*unit,name?name.textContent:null);
    }

    var arcs = pnml.querySelectorAll('arc');
    for (var i=0; i<arcs.length; i++) {
      var arc = arcs[i];
      var id  = arc.getAttributeNS(null,'id');
      var sourceId = arc.getAttributeNS(null,'source');
      var targetId = arc.getAttributeNS(null,'target');
      // message(id+': '+sourceId+' -> '+targetId);
      if (this.transitions[sourceId] && this.places[targetId])
        this.addArc(this.transitions[sourceId],this.places[targetId]);
      else if (this.places[sourceId] && this.transitions[targetId])
        this.addArc(this.places[sourceId],this.transitions[targetId]);
      else
        message('cannot find source and target');
    }

    if (!p || !d) { // no dimensions specified, try bounding box instead
                    // the svg contents bounding box doesn't seem to work right
                    // (apparently, that issue is opera-specific, works in firefox?)
                    // so we use the min/max node coordinates as an approximation
                    // [PNML files should specify intended dimensions to avoid this]
      var bbox = this.contents.getBBox(); // TODO: why isn't this tight in opera?
      message('** (min/max) '+px+' '+py+' '+dx+' '+dy);
      listProperties('contents.BBox',bbox);
      if (navigator.appName.match(/Opera/)) // TODO: test for bug rather than browser
        this.setViewSize(px,py,dx+10,dy+10);
      else
        this.setViewSize(bbox.x,bbox.y,bbox.width,bbox.height);
    }
  } else
    message('querySelectorAll not supported');
}

/**
 * add import PNML, export PNML, export SVG controls to document, just before
 * the Net's SVG node;
 */
Net.prototype.addImportExportControls = function () {

  var net = this; // for use in event handler closures

  // importing PNML files (partially implemented)
  var importPNML = document.createElement('input');
  importPNML.type  = 'file';
  importPNML.name  = 'importPNML'; // TODO: visualize input field purpose
  importPNML.id    = 'importPNML';
  importPNML.style.width = 'auto';
  importPNML.addEventListener('change',function(){
      // grr; thanks to fake_path, opera only gives file name, not relative path
      message(this.value);
      var filename = this.value.replace(/^C:[\/\\]fake_path[\/\\]/,'');
      var xhr = new XMLHttpRequest(); // browser-specific, ok in opera/firefox
      xhr.open('GET',filename,false);
      xhr.send(null);
      var pnml = xhr.responseXML;
      net.removeAll();
      net.fromPNML(pnml);
    },false);
  document.body.insertBefore(importPNML,this.svg);

  // exporting SVG files
  // TODO: are size limits for data:-url still an issue? use document.write instead?
  var exportSVG =document.createElement('input');
  exportSVG.type = 'button';
  exportSVG.id   = 'exportSVG';
  exportSVG.value = 'export SVG';
  exportSVG.style.width = 'auto';
  exportSVG.addEventListener('click',function(){
      // clone svg, then remove interactive elements (not needed for static output)
      // TODO: cloning in opera 10.10 seems to convert some attribute representations
      //       (eg, 'cx' from '100.1' to '100,1')
      var svgOut = net.svg.cloneNode(true);
      svgOut.removeChild(svgOut.querySelector('#cursorPalette'));
      svgOut.removeChild(svgOut.querySelector('#netHelp'));
      // TODO: should we use DOM3 Load and Save / XMLSerializer / toXMLString instead?
      //        or the DOM tree walkers? otherwise, factor listXML from debug to utils
      var xml = listXML('',svgOut).join("\n");
      messagePre(xml);
      delete svgOut;
      // location = 'data:image/svg+xml,'+encodeURIComponent(xml);
      // use application/octet-stream to force "save as"-dialogue
      location = 'data:application/octet-stream,'+encodeURIComponent(xml);
      // TODO: firefox tends to crash here?
    },false);
  document.body.insertBefore(exportSVG,importPNML.nextSibling);

  // exporting PNML files (partially implemented)
  // TODO: are size limits for data:-url still an issue? use document.write instead?
  var exportPNML =document.createElement('input');
  exportPNML.type = 'button';
  exportPNML.id   = 'exportPNML';
  exportPNML.value = 'export PNML';
  exportPNML.style.width = 'auto';
  exportPNML.addEventListener('click',function(){
      var pnml = net.toPNML();
      messagePre(pnml);
      // location = 'data:application/xml,'+encodeURIComponent(pnml);
      // use application/octet-stream to force "save as"-dialogue
      location = 'data:application/octet-stream,'+encodeURIComponent(pnml);
    },false);
  document.body.insertBefore(exportPNML,importPNML.nextSibling);
}

// TODO: properly calculate clip and backdrop dimensions
//       read svg viewport spec again, viewBox, viewport and aspect..
//       how to calculate the visible x/y-coordinates automatically?
/**
 * set viewBox, clipBox, and backdrop dimensions
 * 
 * @param x
 * @param y
 * @param w
 * @param h
 */
Net.prototype.setViewSize = function (x,y,w,h) {
  this.width  = w;
  this.height = h;
  this.svg.setAttributeNS(null,'viewBox',x+' '+y+' '+w+' '+h);
  this.svg.setAttributeNS(null,'clip',x+' '+y+' '+w+' '+h); // TODO: is this right?
  var maxExtent = Math.max(this.width,this.height);
  this.svgBackdrop.setAttributeNS(null,'width',maxExtent); 
  this.svgBackdrop.setAttributeNS(null,'height',maxExtent);
  this.svgBackdrop.setAttributeNS(null,'x',x);
  this.svgBackdrop.setAttributeNS(null,'y',y);
}

/**
 * add backdrop (to capture events in the absence of other SVG elements)
 */
Net.prototype.addBackdrop = function () {
  this.svgBackdrop = document.createElementNS(svgNS,'rect');
    this.svgBackdrop.id = 'svgBackdrop';
    var maxExtent = Math.max(this.width,this.height);
    this.svgBackdrop.setAttributeNS(null,'width',maxExtent); 
    this.svgBackdrop.setAttributeNS(null,'height',maxExtent);
    this.svgBackdrop.setAttributeNS(null,'x',0);
    this.svgBackdrop.setAttributeNS(null,'y',-1000);
    this.svgBackdrop.setAttributeNS(null,'style','fill: lightgrey');
    this.svg.appendChild(this.svgBackdrop);
}

/**
 * add help text (visibility can be toggled by pressing '?')
 */
Net.prototype.addHelp = function () {
  this.help = document.createElementNS(svgNS,'text');
  this.help.setAttributeNS(null,'fill','blue');
  this.help.setAttributeNS(null,'font-size','10');
  this.help.id = 'netHelp';
  var lines = ['press "m" then use mouse to move nodes'
              ,'press "t" then click on background to add transitions'
              ,'press "p" then click on background to add places'
              ,'press "a" then drag from node to node to add arcs'
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

/**
 * SVG definitions (currently just an arrowhead marker for arcs)
 */
Net.prototype.addDefs = function () {
  var defs   = document.createElementNS(svgNS,'defs');
  var marker = document.createElementNS(svgNS,'marker');

  marker.id = "Arrow";
  marker.setAttributeNS(null,'viewBox','0 0 10 10');
  marker.setAttributeNS(null,'refX','10');
  marker.setAttributeNS(null,'refY','5');
  marker.setAttributeNS(null,'markerUnits','userSpaceOnUse');
  marker.setAttributeNS(null,'markerWidth','10');
  marker.setAttributeNS(null,'markerHeight','10');
  marker.setAttributeNS(null,'orient','auto');
  var path = document.createElementNS(svgNS,'path');
  path.setAttributeNS(null,'d','M 0 0 L 10 5 L 0 10 z');
  marker.appendChild(path);

  defs.appendChild(marker);
  this.svg.appendChild(defs);
}

/**
 * translate event coordinates to svg coordinates
 * (why is this "screen" vs "client"?)
 * 
 * @param event
 */
Net.prototype.client2canvas = function (event) {
  var ctm = this.svg.getScreenCTM();
  var p = this.svg.createSVGPoint();
  p.x = event.clientX; p.y = event.clientY;
  return p.matrixTransform(ctm.inverse());
}

/**
 * event handler: create and add node (Place or Transition) to Net, depending on
 *                Cursor mode
 * 
 * @param event
 */
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

/**
 * create and add an Arc from source to target, register Arc with Net, source,
 * and target nodes;
 * 
 * @param source
 * @param target
 */
Net.prototype.addArc = function (source,target) {
  if ((source instanceof Transition && target instanceof Place)
    ||(source instanceof Place && target instanceof Transition)) {

    var arc = new Arc(source,target);
    this.arcs.push(arc);
    source.registerArcAtSource(arc);
    target.registerArcAtTarget(arc);
    this.contents.appendChild(arc.a);
    return arc;
  }
}

/**
 * remove Arc, unregister from Net, source and target nodes
 * 
 * @param arc
 */
Net.prototype.removeArc = function (arc) {
  delete this.arcs[this.arcs.indexOf(arc)];
  // TODO: this should move to Arc()
  arc.source.unregisterArcAtSource(arc);
  arc.target.unregisterArcAtTarget(arc);
  this.contents.removeChild(arc.a);
}

/**
 * create and add Place to Net, with id and name, at position x/y, with radius r;
 * name and r are optional
 * 
 * @param id
 * @param x
 * @param y
 * @param r
 * @param name
 */
Net.prototype.addPlace = function (id,x,y,r,name) {
  var place = new Place(this,id,name?name:id
                       ,new Pos(x,y)
                       ,r?r:this.r);
  this.places[id] = place;
  this.contents.appendChild(place.p);
  return place;
}

/**
 * remove Place from Net
 * 
 * @param place
 */
Net.prototype.removePlace = function (place) {
  delete this.places[place.id];
  // TODO: this should move to NODE()
  for (var arcIn in place.arcsIn) this.removeArc(place.arcsIn[arcIn]);
  for (var arcOut in place.arcsOut) this.removeArc(place.arcsOut[arcOut]);
  this.contents.removeChild(place.p);
  this.contents.removeChild(place.l);
}

/**
 * create and add Transition to Net, with id and name, at position x/y, with
 * width w, height h; name, w, and h are optional;
 * 
 * @param id
 * @param x
 * @param y
 * @param w
 * @param h
 * @param name
 */
Net.prototype.addTransition = function (id,x,y,w,h,name) {
  var transition = new Transition(this,id,name?name:id
                                 ,new Pos(x,y)
                                 ,w?w:this.transitionWidth
                                 ,h?h:this.transitionHeight
                                 );
  this.transitions[id] = transition;
  this.contents.appendChild(transition.t);
  return transition;
}

/**
 * remove Transition from Net
 * 
 * @param transition
 */
Net.prototype.removeTransition = function (transition) {
  delete this.transitions[transition.id];
  // TODO: this should move to NODE()
  for (var arcIn in transition.arcsIn) this.removeArc(transition.arcsIn[arcIn]);
  for (var arcOut in transition.arcsOut) this.removeArc(transition.arcsOut[arcOut]);
  this.contents.removeChild(transition.t);
  this.contents.removeChild(transition.l);
}

/**
 * remove all nodes (and therefore, all arcs) from Net
 */
Net.prototype.removeAll = function () {
  for (var p in this.places) this.removePlace(this.places[p]);
  for (var t in this.transitions) this.removeTransition(this.transitions[t]);
}

// seems we can only listen for keys outside svg
// we only set a mode for use in later click events 
// TODO: move to Cursor?
/**
 * event handler: listen to keypresses, setting Cursor mode
 * 
 * @param event
 */
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
             // TODO: also need '\esc' to cancel anything in progress,
             //       such as moves, partial arcs, ..
  }
  // event.preventDefault(); // how to do this only inside svg?
  return true;
}

/**
 * event handler: let Cursor position follow mouse moves
 * 
 * @param event
 */
Net.prototype.mousemoveHandler = function (event) {
  var p = this.client2canvas(event);
  // message('Net.mousemoveHandler '+p.x+'/'+p.y);
  this.cursor.updatePos(p);
  return true;
}

// ----------------------------- }}}

