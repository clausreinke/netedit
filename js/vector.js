//
// minimal position representation and vector operations
// (load before net-elements.js and net.js)
//

module("vector.js",[],function() {

/**
 * basic 2d positions, with interface to 2d vectors
 * 
 * @param x
 * @param y
 */
function Pos(x,y) {
  this.x = x;
  this.y = y;
}
Pos.prototype.toString = function() {
  return 'Pos('+this.x+','+this.y+')';
}
Pos.prototype.vectorTo = function(pos) {
  return new Vector(pos.x-this.x,pos.y-this.y);
}
Pos.prototype.add = function(vec) {
  return new Pos(vec.x+this.x,vec.y+this.y);
}
Pos.prototype.close = function(pos) {
  return (Math.abs(pos.x-this.x)<1) && (Math.abs(pos.y-this.y)<1);
}

/**
 * 2d vectors, just the operations used in net editor
 * 
 * @param x
 * @param y
 */
function Vector(x,y) {
  this.x = x;
  this.y = y;
}
Vector.prototype.toString = function() {
  return 'Vector('+this.x+','+this.y+')';
}
Vector.prototype.length = function() {
  return Math.sqrt(this.x*this.x+this.y*this.y);
}
Vector.prototype.scale = function(s) {
  return new Vector(s*this.x,s*this.y);
}
Vector.prototype.add = function(vec) {
  return new Vector(vec.x+this.x,vec.y+this.y);
}
Vector.prototype.dot = function(vec) {
  return vec.x*this.x+vec.y*this.y;
}
Vector.prototype.close = function(vec) {
  return (Math.abs(vec.x-this.x)<1) && (Math.abs(vec.y-this.y)<1);
}

// exports
return { Pos:    Pos
       , Vector: Vector
       };
});
