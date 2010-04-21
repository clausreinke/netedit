//
// Net import/export (load on top of net.js)
//

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

  var importExportGroup = document.createElement('label');
  importExportGroup.setAttribute('style','background: lightgrey; margin-left: 10px');
  importExportGroup.appendChild(document.createTextNode('import PNML: '));
  document.body.insertBefore(importExportGroup,this.svg);

  // importing PNML files (partially implemented)
  var importPNML = document.createElement('input');
  importPNML.type  = 'file';
  importPNML.title = 'import PNML';
  importPNML.id    = 'importPNML';
  // TODO: which event to listen to? change is much too frequent, input doesn't
  //       work in firefox
  importPNML.addEventListener('submit',function(){
      // grr; selection only gives fake_path + file name, no relative path
      // workaround: enter relative path manually in input field
      // this workaround doesn't work in firefox (field not editable)
      message('importing PNML file '+this.value+' - '+this.files);
      var filename = this.value.replace(/^C:[\/\\]fake_path[\/\\]/,'');
      var xhr = new XMLHttpRequest(); // browser-specific, ok in opera/firefox
      xhr.open('GET',filename,false);
      xhr.send(null);
      var pnml = xhr.responseXML;
      net.removeAll();
      net.fromPNML(pnml);
    },false);
  importExportGroup.appendChild(importPNML);

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
      // TODO: firefox used to crash here; no longer, but what was the problem?
    },false);
  exportSVG.setAttribute('style','margin-left: 10px');
  importExportGroup.appendChild(exportSVG);

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
  exportPNML.setAttribute('style','margin-left: 10px');
  importExportGroup.appendChild(exportPNML);
}


