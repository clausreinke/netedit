// 
// Net elements: Nodes (Places, Transitions) and Arcs (load before net.js)
//

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
  this.l = elementNS(svgNS,'text'
                    ,{'class':'label'
                     ,'stroke':'black'
                     ,'stroke-width':'0.1px'
                     ,'font-size':'10px'
                     ,'x':x
                     ,'y':y
                     }
                    ,[document.createTextNode(this.name)]);
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
  if (this.net.selection) return true; // don't add second set of event handlers
  if (this.net.cursor.mode==='m') {
    this.net.selection = this;
    var action = this.mousemoveHandler;
  } else if (this.net.cursor.mode==='a') {
    this.net.selection = new Arc(this,this.net.cursor);
    this.net.selection.a.id = 'partialArc';
    // place the arc first in contents group, so it isn't hiding anything
    // (to keep it from grabbing any events meant for the target node)
    this.net.contents.insertBefore(this.net.selection.a
                                  ,this.net.contents.firstChild.nextSibling);
    var action = this.newArcHandler;
  } else
    return true;
  // need to keep references to dynamically constructed listeners,
  // or removeEventListener wouldn't work
  this.listeners = { 'mousemove' : bind(action,this)
                   , 'mouseup'   : bind(this.mouseupHandler,this)
                   }
  // redirect whole-svg events 
  // if mouse is faster than rendering, events might otherwise miss small shapes
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
  this.cancelListeners();
  return true;
}

/**
 * cancel mode-specific event listeners created from this node
 */
Node.prototype.cancelListeners = function() {
  for (var l in this.listeners) 
    this.net.svg.removeEventListener(l,this.listeners[l],false);
  this.listeners = {};
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
  // note: it is tempting to group node and label, using relative position for
  //       the latter; that would scale to groups of view objects; but we need
  //       to group labels separately, to ensure they are not overlapped by
  //       other elements:-(
  // TODO: filter/translate to get valid/unique ids only!
  this.p = this.placeShape(this.id,this.pos.x,this.pos.y,this.r);
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
Place.prototype.placeShape = function (id,x,y,r) {
  return elementNS(svgNS,'circle'
                  ,{'class':'place'
                   ,'id':id
                   ,'cx':x
                   ,'cy':y
                   ,'r':r
                   ,'stroke':'black'
                   ,'stroke-width':'1px'
                   ,'fill':'white'
                   });
}

/**
 * update graphical representation following model changes
 */
Place.prototype.updateView = function() {
  this.p.id = this.id; // TODO: filter/translate to get valid/unique ids only!
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
  // note: it is tempting to group node and label, using relative position for
  //       the latter; that would scale to groups of view objects; but we need
  //       to group labels separately, to ensure they are not overlapped by
  //       other elements:-(
  // TODO: filter/translate to get valid/unique ids only!
  this.t = this.transitionShape(this.id,this.pos.x,this.pos.y
                                       ,this.width,this.height);
  this.t.addEventListener('click',bind(this.clickHandler,this),false);
  this.t.addEventListener('mousedown',bind(this.mousedownHandler,this),false);
  this.t.addEventListener('mouseup',bind(this.mouseupHandler,this),false);
  this.addLabel(this.pos.x+0.6*this.width,this.pos.y+0.5*this.height);
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
Transition.prototype.transitionShape = function (id,x,y,w,h) {
  return elementNS(svgNS,'rect'
                  ,{'class':'transition'
                   ,'id':id
                   ,'x':x - w/2
                   ,'y':y - h/2
                   ,'width':w
                   ,'height':h
                   ,'stroke':'black'
                   ,'stroke-width':'1px'
                   ,'fill':'darkgrey'
                   });
}

/**
 * update graphical representation following model changes
 */
Transition.prototype.updateView = function() {
  var x2 = this.pos.x - this.width/2;
  var y2 = this.pos.y - this.height/2;
  this.t.id = this.id; // TODO: filter/translate to get valid/unique ids only!
  this.t.setAttributeNS(null,'x',x2); 
  this.t.setAttributeNS(null,'y',y2); 
  this.t.setAttributeNS(null,'width',this.width);
  this.t.setAttributeNS(null,'height',this.height);
  this.l.setAttributeNS(null,'x',this.pos.x+0.6*this.width);
  this.l.setAttributeNS(null,'y',this.pos.y+0.5*this.height);
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

// TODO: we might need to add a transparent halo, to make arcs easier to select
/**
 * an Arc is visually represented by graphical view (an SVG path); it reacts to
 * click events
 */
Arc.prototype.addView = function() {
  this.a = elementNS(svgNS,'path'
                    ,{'style':'stroke: black; stroke-width: 1px'
                     ,'class':'arc'
                     ,'marker-end':'url(#Arrow)'
                     });
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

