//
// Net import/export (load on top of net.js)
//

// TODO: we have extra lines accumulating around text node contents
//       during import/export loops (as well as extra whitespace around
//       text nodes during Node.rename)

/**
 * render Net as PNML document string
 */
Net.prototype.toPNML = function() { // {{{
  // auxiliary definitions for PNML format elements
  var dimension  = function(x,y) { 
                    return elementNS(null,'dimension',{'x':x,'y':y});
                   }
  var position   = function(x,y) {
                    return elementNS(null,'position',{'x':x,'y':y});
                   }
  var graphics   = function(children) {
                    return elementNS(null,'graphics',{},children);
                   }
  var name       = function(text) {
                     return elementNS(null,'name',{}
                                     ,[elementNS(null,'text',{}
                                                ,[document.createTextNode(text)])]);
                   }
  var place      = function(id,n,x,y) {
                     return elementNS(null,'place'
                                     ,{'id':id}
                                     ,[name(n),graphics([position(x,y)])]);
                   }
  var transition = function(id,n,x,y) {
                    return elementNS(null,'transition'
                                    ,{'id':id}
                                    ,[name(n),graphics([position(x,y)])]);
                   }
  var arc        = function(id,source,target) {
                     return elementNS(null,'arc'
                                    ,{'id':id,'source':source,'target':target});
                   }
  var net        = function(type,id,children) {
                     return elementNS(null,'net'
                                     ,{'type':type,'id':id}
                                     ,children);
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
} // }}}

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
Net.prototype.fromPNML = function(pnml,scale,unit) { // {{{
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
    message('** net dimensions '+p+'|'+d+' : '+px+' '+py+' '+dx+' '+dy);
    // if dimensions are missing, we'll try to estimate them
    // (we keep track of max node coordinates)
    if (!d) { dx = 0; dy = 0; } 

    // extract minimal info about places (name, position), transitions (name,
    // position) and arcs (source, target), add corresponding elements to Net
    // note: we could common up the two node loops place/transition, but
    //       attributes for higher level nets will differ between the two
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
      var bbox = this.contents.getBBox(); // TODO: why isn't this tight in opera 10.10?
      message('** (min/max) '+px+' '+py+' '+dx+' '+dy);
      listProperties('contents.BBox',bbox);
      if (false&&navigator.appName.match(/Opera/)) // TODO: bounding box bug fixed in 10.51?
        this.setViewSize(px,py,dx+10,dy+10);
      else
        this.setViewSize(bbox.x,bbox.y,bbox.width,bbox.height);
    }
  } else
    message('querySelectorAll not supported');
} // }}}

/**
 * add import PNML, export PNML, export SVG controls to document, just before
 * the Net's SVG node;
 */
Net.prototype.addImportExportControls = function () { // {{{

  var net = this; // for use in event handler closures

  // importing PNML files (partially implemented)
  var importButton   = element('input'
                              ,{"type" : 'submit'
                               ,"id"   : 'importButton'
                               ,"value": 'import PNML'
                               });
  var importSelector = element('input'
                              ,{"type" : 'file'
                               ,"id"   : 'importSelector'
                               ,"title": 'select PNML file to import'
                               ,"style": 'width: auto'
                               });
  var importForm     = element('form'
                              ,{'action':'#'
                               ,'style' :'display: inline'}
                              ,[importButton,importSelector]);
  importForm.addEventListener('submit',function(event){
      // grr; while it is easy to import files in the current directory, things
      // get difficult if one likes to organize one's file in a pnml/
      // subdirectory: file selectors only give fake_path + file name, no
      // relative path (security considerations which apply to absolute paths
      // seem to have been interpreted too eagerly?);
      //
      // workaround in opera: enter relative path manually in input field
      // this workaround doesn't work in firefox (field is not editable);
      // it is also awkward because the file selector will insert absolute
      // paths (and with '\' instead of '/' on windows), which need to be
      // edited by hand (field value not accessible);
      //
      // workaround in firefox: use File API, read file without path
      // this doesn't work in opera (no File API yet), but if opera starts
      // supporting the File API, this would be the preferred/standard way,
      // so we use File Api by default, and XMLHttpRequest as a fallback;
      //
      // (a more radical approach would be to switch to using the browsers'
      // widget/elevated-permissions modes)
      // TODO: clean up!
      var pnml = null;
      message('importing PNML file '+importSelector.value);
      if (importSelector.files) { // use File API, if present
        message('File API available');
        if (importSelector.files.item(0)) {
          var contents = importSelector.files.item(0).getAsText(null);
          messagePre(contents);
          if (DOMParser) {
            var parser = new DOMParser();
            var pnml   = parser.parseFromString(contents,'text/xml');
          } else
            message('sorry, cannot find DOMParser');
        } else {
          message('sorry, no file name specified');
        }
      } else if (XMLHttpRequest) { // conventional route, limited by filepath security
        if (importSelector.value) {
          var filename = importSelector.value.replace(/^C:[\/\\]fake_?path[\/\\]/,'');
          message('(useable portion of) filename is: '+filename);
          message('(note: local filenames should be written as _relative_ paths with _forward_ slashes)');
          message('falling back to XMLHttpRequest');
          var xhr = new XMLHttpRequest(); // browser-specific, ok in opera/firefox
          try {
            xhr.open('GET',filename,false);
            xhr.send(null);
          } catch (e) {
            message('unable to import PNML file: ');
            messagePre(e.toString());
          }
          var pnml = xhr.responseXML;
          // listProperties('xhr',xhr,/./,true);
        } else
          message('sorry, no file name specified');
      } else
        message('unable to import PNML file');
      if (pnml) {
        // TODO: is there a way to determine whether the load was successful?
        //       it seems we can get back a non-null but useless responseXML
        //       if the filename wasn't valid, and the status doesn't seem
        //       helpful for local files (when there was no webserver involved)?
        net.removeAll();
        try { net.fromPNML(pnml) }
        catch (e) {
          message('PNML document could not be interpreted (is the filename correct?):');
          messagePre(e.toString());
          messagePre(listXML('',pnml).join("\n"));
        }
      } else
        message('no PNML file loaded');
      event.preventDefault();
      return false;
    },false);

  // exporting SVG files
  // TODO: - are size limits for data:-url still an issue? use document.write instead?
  //       - unlike opera, firefox doesn't seem to give us control of where to
  //         save, and under what name (everything goes in the download folder,
  //         with automatically generated names)
  var exportSVG = element('input'
                         ,{"type" : 'button'
                          ,"id"   : 'exportSVG'
                          ,"value": 'export SVG'
                          ,"style": 'margin-left: 10px'
                          });
  exportSVG.addEventListener('click',function(){
      // clone svg, then remove interactive elements (not needed for static output)
      // NOTE: cloning in opera 10.10 seems to convert some attribute representations
      //       (eg, 'cx' from '100.1' to '100,1'); seems fixed in 10.51
      var svgOut = net.svg.cloneNode(true);
      svgOut.removeChild(svgOut.querySelector('#cursorPalette'));
      svgOut.removeChild(svgOut.querySelector('#netHelp'));
      // TODO: should we use DOM3 Load and Save / XMLSerializer / toXMLString instead?
      //        or the DOM tree walkers? otherwise, move listXML from debug to utils
      var xml = listXML('',svgOut).join("\n");
      messagePre(xml);
      delete svgOut;
      // location = 'data:image/svg+xml,'+encodeURIComponent(xml);
      // TODO: firefox used to crash here; no longer, but what was the problem?
      // use application/octet-stream to force "save as"-dialogue
      location = 'data:application/octet-stream,'+encodeURIComponent(xml);
    },false);

  // exporting PNML files (partially implemented)
  // TODO: - are size limits for data:-url still an issue? use document.write instead?
  //         (for now, we leave the debug printouts in; if data: should fail, one
  //         could still copy from the messages div to avoid loosing work)
  //       - unlike opera, firefox doesn't seem to give us control of where to
  //         save, and under what name (everything goes in the download folder,
  //         with automatically generated names)
  var exportPNML = element('input'
                          ,{"type" : 'button'
                           ,"id"   : 'exportPNML'
                           ,"value": 'export PNML'
                           ,"style": 'margin-left: 10px'
                           });
  exportPNML.addEventListener('click',function(){
      var pnml = net.toPNML();
      messagePre(pnml);
      // location = 'data:application/xml,'+encodeURIComponent(pnml);
      // use application/octet-stream to force "save as"-dialogue
      location = 'data:application/octet-stream,'+encodeURIComponent(pnml);
    },false);

  // TODO: if we want to use this, eg, for cursor coordinates, we need
  //       better layout control
  var messageField = element('div',{"id":'messageField'});

  var importExportGroup = element('div'
                                 ,{"id":'importExportGroup'}
                                 ,[importForm,exportSVG,exportPNML,messageField]);
  this.svgDiv.insertBefore(importExportGroup,this.svg);
} // }}}

