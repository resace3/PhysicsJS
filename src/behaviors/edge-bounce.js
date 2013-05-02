// edge-bounce behavior
Physics.behavior('edge-bounce', function( parent ){

    var defaults = {

        bounds: null,
        restitution: 1.0
    };

    var PUBSUB_TOPIC = 'edge-bounce';

    var perp = Physics.vector(); //tmp
    var applyImpulse = function applyImpulse(state, n, r, moi, mass, cor, cof){

        perp.clone( n ).perp( true );

        // break up components along normal and perp-normal directions
        var v = state.vel
            ,angVel = state.angular.vel
            ,vproj = v.proj( n ) // projection of v along n
            ,vreg = v.proj( perp ) // rejection of v along n (perp of proj)
            ,rproj = r.proj( n )
            ,rreg = r.proj( perp )
            ,impulse
            ,sign
            ,max
            ,inContact = false
            ,invMass = 1 / mass
            ,invMoi = 1 / moi
            ;

        // account for rotation ... += (r omega) in the tangential direction
        vproj += angVel * rreg;
        vreg += angVel * rproj;

        impulse =  - ((1 + cor) * vproj) / ( invMass + (invMoi * rreg * rreg) );
        vproj += impulse * ( invMass + (invMoi * rreg * rreg) );
        angVel -= impulse * rreg * invMoi;
        // inContact = (impulse < 0.004);
        
        // if we have friction and a relative velocity perpendicular to the normal
        if ( cof && vreg ){

            // maximum impulse allowed by friction
            max = vreg / ( invMass + (invMoi * rproj * rproj) );

            if (!inContact){
                // the sign of vreg ( plus or minus 1 )
                sign = vreg < 0 ? -1 : 1;

                // get impulse due to friction
                impulse *= sign * cof;
                // make sure the impulse isn't giving the system energy
                impulse = (sign === 1) ? Math.min( impulse, max ) : Math.max( impulse, max );
                
            } else {

                impulse = max;
            }

            angVel -= impulse * rproj * invMoi;
            vreg -= impulse * ( invMass + (invMoi * rproj * rproj) );
        }

        // adjust velocities
        state.angular.vel = angVel;
        v.clone( n ).mult( vproj - angVel * rreg ).vadd( perp.mult( vreg - angVel * rproj ) );
    };

    return {

        priority: 2,

        init: function( options ){

            // call parent init method
            parent.init.call(this, options);

            options = Physics.util.extend({}, defaults, options);

            this.setAABB( options.aabb );
            this.restitution = options.restitution;
        },

        setAABB: function( aabb ){

            if (!aabb) {
                throw 'Error: aabb not set';
            }

            this.aabb = aabb;
            this._edges = [
                // set edges
            ];
        },
        
        behave: function( bodies, dt ){

            var body
                ,pos
                ,state
                ,scratch = Physics.scratchpad()
                ,p = scratch.vector()
                ,aabb = this.aabb.get()
                ,world = this._world
                ,dim
                ,x
                ,cor
                ,cof = 0.6
                ,norm = scratch.vector()
                ,impulse
                ;

            for ( var i = 0, l = bodies.length; i < l; ++i ){
                
                body = bodies[ i ];
                state = body.state;
                pos = body.state.pos;
                cor = body.restitution * this.restitution;

                switch ( body.geometry.name ){

                    case 'circle':
                        dim = body.geometry.radius;
                        x = body.moi / body.mass;

                        // right
                        if ( (pos._[ 0 ] + dim) >= aabb.max.x ){

                            norm.set(-1, 0);
                            p.set(dim, 0); // set perpendicular displacement from com to impact point
                            
                            // adjust position
                            pos._[ 0 ] = aabb.max.x - dim;

                            applyImpulse(state, norm, p, body.moi, body.mass, cor, cof);

                            p.set( aabb.max.x, pos._[ 1 ] );
                            if (world){
                                world.publish({ topic: PUBSUB_TOPIC, body: body, point: p.values() });
                            }
                        }
                        
                        // left
                        if ( (pos._[ 0 ] - dim) <= aabb.min.x ){

                            norm.set(1, 0);
                            p.set(-dim, 0); // set perpendicular displacement from com to impact point
                            
                            // adjust position
                            pos._[ 0 ] = aabb.min.x + dim;

                            applyImpulse(state, norm, p, body.moi, body.mass, cor, cof);

                            p.set( aabb.min.x, pos._[ 1 ] );
                            if (world){
                                world.publish({ topic: PUBSUB_TOPIC, body: body, point: p.values() });
                            }
                        }

                        // bottom
                        if ( (pos._[ 1 ] + dim) >= aabb.max.y ){

                            norm.set(0, -1);
                            p.set(0, dim); // set perpendicular displacement from com to impact point
                            
                            // adjust position
                            pos._[ 1 ] = aabb.max.y - dim;

                            applyImpulse(state, norm, p, body.moi, body.mass, cor, cof);

                            p.set( pos._[ 0 ], aabb.max.y );
                            if (world){
                                world.publish({ topic: PUBSUB_TOPIC, body: body, point: p.values() });
                            }
                        }
                            
                        // top
                        if ( (pos._[ 1 ] - dim) <= aabb.min.y ){

                            norm.set(0, 1);
                            p.set(0, -dim); // set perpendicular displacement from com to impact point
                            
                            // adjust position
                            pos._[ 1 ] = aabb.min.y + dim;

                            applyImpulse(state, norm, p, body.moi, body.mass, cor, cof);

                            p.set( pos._[ 0 ], aabb.min.y );
                            if (world){
                                world.publish({ topic: PUBSUB_TOPIC, body: body, point: p.values() });
                            }
                        }

                    break;
                }
            }

            scratch.done();
        }
    };
});
