var svgNS = 'http://www.w3.org/2000/svg';

// ----------------- simple Petri net editor

// Version 0.1 (<date>)
//
// Can currently edit simple, single-page Place/Transition-Nets without
// markings, export them to PNML or SVG, and import them from PNML. Lots of
// basic features still missing in this initial release (also, consider it 
// alpha quality!-)

// So far, this is more a browser-as-a-portable-GUI-library kind of application
// than a put-it-on-the-web thing (initial intended use case was to hook it into
// a Haskell code generator and simulator for Haskell-Coloured Petri Nets,
// eliminating the wxWidgets GUI lib dependency of an earlier HCPN
// implementations); hence, it is SVG only at the moment, and written to modern
// standards, rather than to browser quirks - currently, it works with opera and
// firefox (with few quirks), possibly with others, but definitely not with
// current versions of IE (IE9 might well work, if the previews are any
// indication, but I haven't tested that yet);
//
// obviously, the frontend could have separate applications for putting Petri
// nets on the web, in blogs, tutorials, and the like, or as a simple GUI for
// other backends (different net types and their simulators);
//
// at minimum, we would need to add VML backend for pre-IE9 to support
// on-the-web for a larger audience; defining an API for hooking up code
// generators or simulators would help with frontend reuse, and with putting
// dynamic Net simulations on the web;

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

// TODO: {{{
//       - add generic net traversal, or at least
//          - static output formats (SVG done, VML missing)
//          - import/export formats (PNML - import and export partially done)
//       - add token model and view objects (net markings)
//       - support multipoint arcs
//       - have separate svg groups to add nodes/arcs or labels to,
//         to ensure that all labels overlap all other objects
//
//       - support canvas scaling and scrolling (how does that interact
//          with the dummy background we need for event capture?)
//       - hook up to code generator / simulator
//          (to help visualizing marking evolution, improved view handling would
//           be helpful, so that we can select interesting places and add
//           additional views to them, showing their tokens; task listed below)
//       - provide api for trace viewing / simulator integration; a standard XML
//         format for net simulation traces would be useful (initially sequences
//         of marking changes instead of sequences of markings; later more
//         complex trace structures, with alternatives and annotations - similar
//         to annotated board game records, but using net-like format)
//
//       - support node resize (if we want asymmetric transitions, also rotation?)
//       - generalize view handling (generic view objects instead of
//          Place/Transition/Arc-specific .p/.t/.a and .l)
//       - allow default styling to be overridden via css (two issues:
//          1. don't specify local style if applicable style exists
//          2. we currently avoid css-style in favour of svg attributes)
//       - may need to prevent default event handling (overlap with
//          browser keyboard shortcuts or drag&drop), but we only want to do
//          that within the SVG canvas, while we seem forced to catch keyboard
//          events outside..
//       - command history/undo?
//       - can we reduce the number of explicitly named xml-namespaces 
//         in svg createElementNSs, without running into problems when 
//         manipulating those elements (compare svg/pnml exports)?
//       - this was initially meant to use modern standards-compliant browsers
//         as portable GUI libraries, so we only test with/support opera and
//         firefox; users will probably ask for other browsers nevertheless -
//         how difficult would it be to support IE8 (VML instead of SVG, lots of
//         other differences/missing features) and possibly Safari/Chrome (only
//         if no special case code needed for these)
//       - start automating tests prior to release, so that we have a chance
//         of seeing what might be missing when things fail silently with other
//         browsers/versions/oss 
// }}}

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
function Net(id,width,height) {

  this.id     = id;
  this.svg    = document.createElementNS(svgNS,'svg');
  this.svg.id = id;
  this.svg.setAttributeNS(null,'version','1.1');
  this.svg.setAttributeNS(null,'width','90%');
  this.svg.setAttributeNS(null,'height','10cm');
  this.svg.style.marginLeft = '10px';

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

  // TODO: maintain separate groups for places/transitions/arcs and labels,
  //       to ensure that labels are never overlapped by other elements

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
              ,' '
              ,'use file selector above to import simple PNML files'
              ,'use "export PNML" button above to export simple PNML files'
              ,'use "export SVG" button above to export SVG files'
              ,' '
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
             // '\esc' should cancel anything in progress, leaving neutral state
             // TODO: doesn't always work for node move
             //       (move node, leave canvas, mouseup, return to canvas,
             //        mousedown => \esc doesn't cancel move anymore)
             if (this.selection) {
               if (this.selection instanceof Arc) {
                 message('cancelling Arc construction in progress');
                 this.contents.removeChild(this.selection.a);
                 for (var l in this.selection.source.listeners)
                   this.svg.removeEventListener(l,this.selection.source.listeners[l],false);
                  this.selection.source.listeners = {};
                 this.selection =  null;            
               } else if ((this.selection instanceof Place)
                        ||(this.selection instanceof Transition)) {
                 message('cancelling Node move in progress');
                 for (var l in this.selection.listeners) 
                   this.svg.removeEventListener(l,this.selection.listeners[l],false);
                 this.selection.listeners = {};
                 this.selection = null;
               }
             }
  }
  // event.preventDefault(); // how to do this only inside svg?
  // message('Net.keypressHandler event.target: '+event.target.nodeName);
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

