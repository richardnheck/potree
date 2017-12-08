Potree.Annotation = class Annotation extends THREE.EventDispatcher {
	constructor (args = {}) {
		super();

		this.scene = null;
		this.title = args.title || 'Annotation #1';
		this.description = args.description || '';

		if (!args.position) {
			// this.position = new THREE.Vector3(0, 0, 0);
			this.position = null;
		} else if (args.position instanceof THREE.Vector3) {
			this.position = args.position;
		} else {
			this.position = new THREE.Vector3(...args.position);
		}

		this.cameraPosition = (args.cameraPosition instanceof Array)
			? new THREE.Vector3().fromArray(args.cameraPosition) : args.cameraPosition;
		this.cameraTarget = (args.cameraTarget instanceof Array)
			? new THREE.Vector3().fromArray(args.cameraTarget) : args.cameraTarget;
		this.radius = args.radius;
		this.view = args.view || null;
		this.keepOpen = false;
		this.descriptionVisible = false;
		this.showDescription = true;
		this.actions = args.actions || [];
		this.isHighlighted = false;
		this._visible = true;
		this.__visible = true;
		this._display = true;
		this._expand = false;
		this.collapseThreshold = [args.collapseThreshold, 100].find(e => e !== undefined);

		this.children = [];
		this.parent = null;
		this.boundingBox = new THREE.Box3();

		let iconClose = Potree.resourcePath + '/icons/close.svg';

		this.domElement = $(`
			<div class="annotation" oncontextmenu="return false;">
				<div class="annotation-titlebar">
					<span class="annotation-label">${this.title}</span>
				</div>
				<div class="annotation-description">
					<span class="annotation-description-close">
						<img src="${iconClose}" width="16px">
					</span>
					<span class="annotation-description-content">${this.description}</span>
				</div>
			</div>
		`);

		this.elTitlebar = this.domElement.find('.annotation-titlebar');
		this.elTitle = this.elTitlebar.find('.annotation-label');
		this.elDescription = this.domElement.find('.annotation-description');
		this.elDescriptionClose = this.elDescription.find('.annotation-description-close');
		// this.elDescriptionContent = this.elDescription.find(".annotation-description-content");

		this.clickTitle = () => {
			if(this.hasView()){
				this.moveHere(this.scene.getActiveCamera());
			}
			this.dispatchEvent({type: 'click', target: this});
		};

		this.elTitle.click(this.clickTitle);

		this.actions = this.actions.map(a => {
			if (a instanceof Potree.Action) {
				return a;
			} else {
				return new Potree.Action(a);
			}
		});

		for (let action of this.actions) {
			action.pairWith(this);
		}

		let actions = this.actions.filter(
			a => a.showIn === undefined || a.showIn.includes('scene'));

		for (let action of actions) {
			this.elTitle.css('padding', '1px 3px 0px 8px');

			let elButton = $(`<img src="${action.icon}" class="annotation-action-icon">`);
			this.elTitlebar.append(elButton);
			elButton.click(() => action.onclick({annotation: this}));
		}

		this.elDescriptionClose.hover(
			e => this.elDescriptionClose.css('opacity', '1'),
			e => this.elDescriptionClose.css('opacity', '0.5')
		);
		this.elDescriptionClose.click(e => this.setHighlighted(false));
		// this.elDescriptionContent.html(this.description);

		this.domElement.mouseenter(e => this.setHighlighted(true));
		this.domElement.mouseleave(e => this.setHighlighted(false));

		this.domElement.on('touchstart', e => {
			this.setHighlighted(!this.isHighlighted);
		});

		this.display = false;
	}

	get visible () {
		return this._visible;
	}

	set visible (value) {
		if (this._visible === value) {
			return;
		}

		this._visible = value;

		this.traverse(node => {
			node.display = value;
		});

		this.dispatchEvent({
			type: 'visibility_changed',
			annotation: this
		});
	}

	get display () {
		return this._display;
	}

	set display (display) {
		if (this._display === display) {
			return;
		}

		this._display = display;

		if (display) {
			// this.domElement.fadeIn(200);
			this.domElement.show();
		} else {
			// this.domElement.fadeOut(200);
			this.domElement.hide();
		}
	}

	get expand () {
		return this._expand;
	}

	set expand (expand) {
		if (this._expand === expand) {
			return;
		}

		if (expand) {
			this.display = false;
		} else {
			this.display = true;
			this.traverseDescendants(node => {
				node.display = false;
			});
		}

		this._expand = expand;
	}

	add (annotation) {
		if (!this.children.includes(annotation)) {
			this.children.push(annotation);
			annotation.parent = this;

			let descendants = [];
			annotation.traverse(a => { descendants.push(a); });

			for (let descendant of descendants) {
				let c = this;
				while (c !== null) {
					c.dispatchEvent({
						'type': 'annotation_added',
						'annotation': descendant
					});
					c = c.parent;
				}
			}
		}
	}

	level () {
		if (this.parent === null) {
			return 0;
		} else {
			return this.parent.level() + 1;
		}
	}

	remove (annotation) {
		this.children = this.children.filter(e => e !== annotation);
		annotation.parent = null;
	}

	updateBounds () {
		let box = new THREE.Box3();

		if (this.position) {
			box.expandByPoint(this.position);
		}

		for (let child of this.children) {
			child.updateBounds();

			box.union(child.boundingBox);
		}

		this.boundingBox.copy(box);
	}

	traverse (handler) {
		let expand = handler(this);

		if (expand === undefined || expand === true) {
			for (let child of this.children) {
				child.traverse(handler);
			}
		}
	}

	traverseDescendants (handler) {
		for (let child of this.children) {
			child.traverse(handler);
		}
	}

	flatten () {
		let annotations = [];

		this.traverse(annotation => {
			annotations.push(annotation);
		});

		return annotations;
	}

	descendants () {
		let annotations = [];

		this.traverse(annotation => {
			if (annotation !== this) {
				annotations.push(annotation);
			}
		});

		return annotations;
	}

	setHighlighted (highlighted) {
		if (highlighted) {
			this.domElement.css('opacity', '0.8');
			this.elTitlebar.css('box-shadow', '0 0 5px #fff');
			this.domElement.css('z-index', '1000');

			if (this.description) {
				this.descriptionVisible = true;
				// this.elDescription.css("display", "block");
				this.elDescription.fadeIn(200);
				this.elDescription.css('position', 'relative');
			}
		} else {
			this.domElement.css('opacity', '0.5');
			this.elTitlebar.css('box-shadow', '');
			this.domElement.css('z-index', '100');
			this.descriptionVisible = false;
			this.elDescription.css('display', 'none');
			// this.elDescription.fadeOut(200);
		}

		this.isHighlighted = highlighted;
	}

	hasView () {
		let hasPosTargetView = this.cameraTarget instanceof THREE.Vector3;
		hasPosTargetView = hasPosTargetView && this.cameraPosition instanceof THREE.Vector3;

		let hasRadiusView = this.radius !== undefined;

		let hasView = hasPosTargetView || hasRadiusView;

		return hasView;
	};

	moveHere (camera) {
		if (!this.hasView()) {
			return;
		}

		let view = this.scene.view;

		var animationDuration = 300;
		var easing = TWEEN.Easing.Quartic.Out;

		let endTarget;
		if (this.cameraTarget) {
			endTarget = this.cameraTarget;
		} else if (this.position) {
			endTarget = this.position;
		} else {
			endTarget = this.boundingBox.getCenter();
		}

		if (this.cameraPosition) {
			let endPosition = this.cameraPosition;

			{ // animate camera position
				let tween = new TWEEN.Tween(view.position).to(endPosition, animationDuration);
				tween.easing(easing);
				tween.start();
			}

			{ // animate camera target
				var camTargetDistance = camera.position.distanceTo(endTarget);
				var target = new THREE.Vector3().addVectors(
					camera.position,
					camera.getWorldDirection().clone().multiplyScalar(camTargetDistance)
				);
				var tween = new TWEEN.Tween(target).to(endTarget, animationDuration);
				tween.easing(easing);
				tween.onUpdate(() => {
					view.lookAt(target);
				});
				tween.onComplete(() => {
					view.lookAt(target);
					this.dispatchEvent({type: 'focusing_finished', target: this});
				});

				this.dispatchEvent({type: 'focusing_started', target: this});
				tween.start();
			}
		} else if (this.radius) {
			let direction = view.direction;
			let endPosition = endTarget.clone().add(direction.multiplyScalar(-this.radius));
			let startRadius = view.radius;
			let endRadius = this.radius;

			{ // animate camera position
				let tween = new TWEEN.Tween(view.position).to(endPosition, animationDuration);
				tween.easing(easing);
				tween.start();
			}

			{ // animate radius
				let t = {x: 0};

				let tween = new TWEEN.Tween(t)
					.to({x: 1}, animationDuration)
					.onUpdate(function () {
						view.radius = this.x * endRadius + (1 - this.x) * startRadius;
					});
				tween.easing(easing);
				tween.start();
			}
		}
	};

	dispose () {
		if (this.domElement.parentElement) {
			this.domElement.parentElement.removeChild(this.domElement);
		}
	};

	toString () {
		return 'Annotation: ' + this.title;
	}
};


Potree.AnnotationMarker = class Measure extends THREE.Object3D {
	constructor () {
		super();

		this.constructor.counter = (this.constructor.counter === undefined) ? 0 : this.constructor.counter + 1;

		this.name = 'Measure_' + this.constructor.counter;
		this.points = [];
		this._showDistances = true;
		this._showCoordinates = false;
		this._showArea = false;
		this._closed = true;
		this._showAngles = false;
		this._showHeight = false;
		this.maxMarkers = Number.MAX_SAFE_INTEGER;

		this.sphereGeometry = new THREE.SphereGeometry(0.4, 10, 10);
		this.color = new THREE.Color(0xff0000);

		this.lengthUnit = {code: 'm'};

		this.spheres = [];
		this.edges = [];
		this.sphereLabels = [];
		this.edgeLabels = [];
		this.angleLabels = [];
		this.coordinateLabels = [];

		// this.heightEdge;
		// this.heightLabel;
		{ // height stuff
			{ // height line
				let lineGeometry = new THREE.Geometry();
				lineGeometry.vertices.push(
					new THREE.Vector3(),
					new THREE.Vector3(),
					new THREE.Vector3(),
					new THREE.Vector3());
				lineGeometry.colors.push(this.color, this.color, this.color);
				let lineMaterial = new THREE.LineDashedMaterial(
					{ color: 0xff0000, dashSize: 5, gapSize: 2 });

				lineMaterial.depthTest = false;
				this.heightEdge = new THREE.Line(lineGeometry, lineMaterial);
				this.heightEdge.visible = false;

				this.add(this.heightEdge);
			}

			{ // height label
				this.heightLabel = new Potree.TextSprite('');
				this.heightLabel.setBorderColor({r: 0, g: 0, b: 0, a: 0.8});
				this.heightLabel.setBackgroundColor({r: 0, g: 0, b: 0, a: 0.3});
				this.heightLabel.setTextColor({r: 180, g: 220, b: 180, a: 1.0});
				this.heightLabel.material.depthTest = false;
				this.heightLabel.material.opacity = 1;
				this.heightLabel.visible = false; ;
				this.add(this.heightLabel);
			}
		}

		this.areaLabel = new Potree.TextSprite('');
		this.areaLabel.setBorderColor({r: 0, g: 0, b: 0, a: 0.8});
		this.areaLabel.setBackgroundColor({r: 0, g: 0, b: 0, a: 0.3});
		this.areaLabel.setTextColor({r: 180, g: 220, b: 180, a: 1.0});
		this.areaLabel.material.depthTest = false;
		this.areaLabel.material.opacity = 1;
		this.areaLabel.visible = false; ;
		this.add(this.areaLabel);
	}

	createSphereMaterial () {
		let sphereMaterial = new THREE.MeshLambertMaterial({
			shading: THREE.SmoothShading,
			color: this.color,
			depthTest: false,
			depthWrite: false}
		);

		return sphereMaterial;
	};

	addMarker (point) {
		if (point instanceof THREE.Vector3) {
			point = {position: point};
		}
		this.points.push(point);

		// sphere
		let sphere = new THREE.Mesh(this.sphereGeometry, this.createSphereMaterial());

		this.add(sphere);
		this.spheres.push(sphere);

		{ // edges
			let lineGeometry = new THREE.Geometry();
			lineGeometry.vertices.push(new THREE.Vector3(), new THREE.Vector3());
			lineGeometry.colors.push(this.color, this.color, this.color);
			let lineMaterial = new THREE.LineBasicMaterial({
				linewidth: 1
			});
			lineMaterial.depthTest = false;
			let edge = new THREE.Line(lineGeometry, lineMaterial);
			edge.visible = true;

			this.add(edge);
			this.edges.push(edge);
		}

		{ // edge labels
			let edgeLabel = new Potree.TextSprite();
			edgeLabel.setBorderColor({r: 0, g: 0, b: 0, a: 0.8});
			edgeLabel.setBackgroundColor({r: 0, g: 0, b: 0, a: 0.3});
			edgeLabel.material.depthTest = false;
			edgeLabel.visible = false;
			this.edgeLabels.push(edgeLabel);
			this.add(edgeLabel);
		}

		{ // angle labels
			let angleLabel = new Potree.TextSprite();
			angleLabel.setBorderColor({r: 0, g: 0, b: 0, a: 0.8});
			angleLabel.setBackgroundColor({r: 0, g: 0, b: 0, a: 0.3});
			angleLabel.material.depthTest = false;
			angleLabel.material.opacity = 1;
			angleLabel.visible = false;
			this.angleLabels.push(angleLabel);
			this.add(angleLabel);
		}

		{ // coordinate labels
			let coordinateLabel = new Potree.TextSprite();
			coordinateLabel.setBorderColor({r: 0, g: 0, b: 0, a: 0.8});
			coordinateLabel.setBackgroundColor({r: 0, g: 0, b: 0, a: 0.3});
			coordinateLabel.material.depthTest = false;
			coordinateLabel.material.opacity = 1;
			coordinateLabel.visible = false;
			this.coordinateLabels.push(coordinateLabel);
			this.add(coordinateLabel);
		}

		{ // Event Listeners
			let drag = (e) => {
				let I = Potree.utils.getMousePointCloudIntersection(
					e.drag.end, 
					e.viewer.scene.getActiveCamera(), 
					e.viewer.renderer, 
					e.viewer.scene.pointclouds);

				if (I) {
					let i = this.spheres.indexOf(e.drag.object);
					if (i !== -1) {
						let point = this.points[i];
						for (let key of Object.keys(I.point).filter(e => e !== 'position')) {
							point[key] = I.point[key];
						}

						this.setPosition(i, I.location);
					}
				}
			};

			let drop = e => {
				let i = this.spheres.indexOf(e.drag.object);
				if (i !== -1) {
					this.dispatchEvent({
						'type': 'marker_dropped',
						'measurement': this,
						'index': i
					});
				}
			};

			let mouseover = (e) => e.object.material.emissive.setHex(0x888888);
			let mouseleave = (e) => e.object.material.emissive.setHex(0x000000);

			sphere.addEventListener('drag', drag);
			sphere.addEventListener('drop', drop);
			sphere.addEventListener('mouseover', mouseover);
			sphere.addEventListener('mouseleave', mouseleave);
		}

		let event = {
			type: 'marker_added',
			measurement: this,
			sphere: sphere
		};
		this.dispatchEvent(event);

		this.setMarker(this.points.length - 1, point);
	};

	removeMarker (index) {
		this.points.splice(index, 1);

		this.remove(this.spheres[index]);

		let edgeIndex = (index === 0) ? 0 : (index - 1);
		this.remove(this.edges[edgeIndex]);
		this.edges.splice(edgeIndex, 1);

		this.remove(this.edgeLabels[edgeIndex]);
		this.edgeLabels.splice(edgeIndex, 1);
		this.coordinateLabels.splice(index, 1);

		this.spheres.splice(index, 1);

		this.update();

		this.dispatchEvent({type: 'marker_removed', measurement: this});
	};

	setMarker (index, point) {
		this.points[index] = point;

		let event = {
			type: 'marker_moved',
			measure:	this,
			index:	index,
			position: point.position.clone()
		};
		this.dispatchEvent(event);

		this.update();
	}

	setPosition (index, position) {
		let point = this.points[index];
		point.position.copy(position);

		let event = {
			type: 'marker_moved',
			measure:	this,
			index:	index,
			position: position.clone()
		};
		this.dispatchEvent(event);

		this.update();
	};

	getArea () {
		let area = 0;
		let j = this.points.length - 1;

		for (let i = 0; i < this.points.length; i++) {
			let p1 = this.points[i].position;
			let p2 = this.points[j].position;
			area += (p2.x + p1.x) * (p1.y - p2.y);
			j = i;
		}

		return Math.abs(area / 2);
	};

	getTotalDistance () {
		if (this.points.length === 0) {
			return 0;
		}

		let distance = 0;

		for (let i = 1; i < this.points.length; i++) {
			let prev = this.points[i - 1].position;
			let curr = this.points[i].position;
			let d = prev.distanceTo(curr);

			distance += d;
		}

		if (this.closed && this.points.length > 1) {
			let first = this.points[0].position;
			let last = this.points[this.points.length - 1].position;
			let d = last.distanceTo(first);

			distance += d;
		}

		return distance;
	}

	getAngleBetweenLines (cornerPoint, point1, point2) {
		let v1 = new THREE.Vector3().subVectors(point1.position, cornerPoint.position);
		let v2 = new THREE.Vector3().subVectors(point2.position, cornerPoint.position);
		return v1.angleTo(v2);
	};

	getAngle (index) {
		if (this.points.length < 3 || index >= this.points.length) {
			return 0;
		}

		let previous = (index === 0) ? this.points[this.points.length - 1] : this.points[index - 1];
		let point = this.points[index];
		let next = this.points[(index + 1) % (this.points.length)];

		return this.getAngleBetweenLines(point, previous, next);
	};

	update () {
		if (this.points.length === 0) {
			return;
		} else if (this.points.length === 1) {
			let point = this.points[0];
			let position = point.position;
			this.spheres[0].position.copy(position);

			{ // coordinate labels
				let coordinateLabel = this.coordinateLabels[0];
				
				//let labelPos = position.clone();//.add(new THREE.Vector3(0,1,0));
				//coordinateLabel.position.copy(labelPos);
				
				/*let msg = Potree.utils.addCommas(position.x.toFixed(2)) 
					+ " / " + Potree.utils.addCommas(position.y.toFixed(2)) 
					+ " / " + Potree.utils.addCommas(position.z.toFixed(2));*/
				let msg = Potree.utils.addCommas(position.z.toFixed(2) + " " + this.lengthUnit.code);
				coordinateLabel.setText(msg);

				coordinateLabel.visible = this.showCoordinates;
			}

			return;
		}

		let lastIndex = this.points.length - 1;

		let centroid = new THREE.Vector3();
		for (let i = 0; i <= lastIndex; i++) {
			let point = this.points[i];
			centroid.add(point.position);
		}
		centroid.divideScalar(this.points.length);

		for (let i = 0; i <= lastIndex; i++) {
			let index = i;
			let nextIndex = (i + 1 > lastIndex) ? 0 : i + 1;
			let previousIndex = (i === 0) ? lastIndex : i - 1;

			let point = this.points[index];
			let nextPoint = this.points[nextIndex];
			let previousPoint = this.points[previousIndex];

			let sphere = this.spheres[index];

			// spheres
			sphere.position.copy(point.position);
			sphere.material.color = this.color;

			{ // edges
				let edge = this.edges[index];

				edge.material.color = this.color;

				edge.position.copy(point.position);

				edge.geometry.vertices[0].set(0, 0, 0);
				edge.geometry.vertices[1].copy(nextPoint.position).sub(point.position);

				edge.geometry.verticesNeedUpdate = true;
				edge.geometry.computeBoundingSphere();
				edge.visible = index < lastIndex || this.closed;
			}

			{ // edge labels
				let edgeLabel = this.edgeLabels[i];

				let center = new THREE.Vector3().add(point.position);
				center.add(nextPoint.position);
				center = center.multiplyScalar(0.5);
				let distance = point.position.distanceTo(nextPoint.position);

				edgeLabel.position.copy(center);
				edgeLabel.setText(Potree.utils.addCommas(distance.toFixed(2)) + ' ' + this.lengthUnit.code);
				edgeLabel.visible = this.showDistances && (index < lastIndex || this.closed) && this.points.length >= 2 && distance > 0;
			}

			{ // angle labels
				let angleLabel = this.angleLabels[i];
				let angle = this.getAngleBetweenLines(point, previousPoint, nextPoint);

				let dir = nextPoint.position.clone().sub(previousPoint.position);
				dir.multiplyScalar(0.5);
				dir = previousPoint.position.clone().add(dir).sub(point.position).normalize();

				let dist = Math.min(point.position.distanceTo(previousPoint.position), point.position.distanceTo(nextPoint.position));
				dist = dist / 9;

				let labelPos = point.position.clone().add(dir.multiplyScalar(dist));
				angleLabel.position.copy(labelPos);

				let msg = Potree.utils.addCommas((angle * (180.0 / Math.PI)).toFixed(1)) + '\u00B0';
				angleLabel.setText(msg);

				angleLabel.visible = this.showAngles && (index < lastIndex || this.closed) && this.points.length >= 3 && angle > 0;
			}

			{ // coordinate labels
				let coordinateLabel = this.coordinateLabels[0];

				let labelPos = point.position.clone().add(new THREE.Vector3(0, 1, 0));
				coordinateLabel.position.copy(labelPos);

				/* let msg = Potree.utils.addCommas(point.position.x.toFixed(2))
					+ " / " + Potree.utils.addCommas(point.position.y.toFixed(2))
					+ " / " + Potree.utils.addCommas(point.position.z.toFixed(2)); */

				let msg = Potree.utils.addCommas(point.position.z.toFixed(2) + ' ' + this.lengthUnit.code);
				coordinateLabel.setText(msg);

				// coordinateLabel.visible = this.showCoordinates && (index < lastIndex || this.closed);
				coordinateLabel.visible = this.showCoordinates;
			}
		}

		{ // update height stuff
			let heightEdge = this.heightEdge;
			heightEdge.visible = this.showHeight;
			this.heightLabel.visible = this.showHeight;

			if (this.showHeight) {
				let sorted = this.points.slice().sort((a, b) => a.position.z - b.position.z);
				let lowPoint = sorted[0].position.clone();
				let highPoint = sorted[sorted.length - 1].position.clone();
				let min = lowPoint.z;
				let max = highPoint.z;
				let height = max - min;

				let start = new THREE.Vector3(highPoint.x, highPoint.y, min);
				let end = new THREE.Vector3(highPoint.x, highPoint.y, max);

				heightEdge.position.copy(lowPoint);

				heightEdge.geometry.vertices[0].set(0, 0, 0);
				heightEdge.geometry.vertices[1].copy(start).sub(lowPoint);
				heightEdge.geometry.vertices[2].copy(start).sub(lowPoint);
				heightEdge.geometry.vertices[3].copy(end).sub(lowPoint);

				heightEdge.geometry.verticesNeedUpdate = true;
				// heightEdge.geometry.computeLineDistances();
				// heightEdge.geometry.lineDistancesNeedUpdate = true;
				heightEdge.geometry.computeBoundingSphere();

				// heightEdge.material.dashSize = height / 40;
				// heightEdge.material.gapSize = height / 40;

				let heightLabelPosition = start.clone().add(end).multiplyScalar(0.5);
				this.heightLabel.position.copy(heightLabelPosition);
				let msg = Potree.utils.addCommas(height.toFixed(2)) + ' ' + this.lengthUnit.code;
				this.heightLabel.setText(msg);
			}
		}

		{ // update area label
			this.areaLabel.position.copy(centroid);
			this.areaLabel.visible = this.showArea && this.points.length >= 3;
			let msg = Potree.utils.addCommas(this.getArea().toFixed(1)) + ' ' + this.lengthUnit.code + '\u00B2';
			this.areaLabel.setText(msg);
		}
	};

	raycast (raycaster, intersects) {
		for (let i = 0; i < this.points.length; i++) {
			let sphere = this.spheres[i];

			sphere.raycast(raycaster, intersects);
		}

		// recalculate distances because they are not necessarely correct
		// for scaled objects.
		// see https://github.com/mrdoob/three.js/issues/5827
		// TODO: remove this once the bug has been fixed
		for (let i = 0; i < intersects.length; i++) {
			let I = intersects[i];
			I.distance = raycaster.ray.origin.distanceTo(I.point);
		}
		intersects.sort(function (a, b) { return a.distance - b.distance; });
	};

	get showCoordinates () {
		return this._showCoordinates;
	}

	set showCoordinates (value) {
		this._showCoordinates = value;
		this.update();
	}

	get showAngles () {
		return this._showAngles;
	}

	set showAngles (value) {
		this._showAngles = value;
		this.update();
	}

	get showHeight () {
		return this._showHeight;
	}

	set showHeight (value) {
		this._showHeight = value;
		this.update();
	}

	get showArea () {
		return this._showArea;
	}

	set showArea (value) {
		this._showArea = value;
		this.update();
	}

	get closed () {
		return this._closed;
	}

	set closed (value) {
		this._closed = value;
		this.update();
	}

	get showDistances () {
		return this._showDistances;
	}

	set showDistances (value) {
		this._showDistances = value;
		this.update();
	}
};