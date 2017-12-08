Potree.AnnotationTool = class AnnotationTool extends THREE.EventDispatcher {
	constructor (viewer) {
		super();

		this.viewer = viewer;
		this.renderer = viewer.renderer;

		this.addEventListener('start_inserting_annotation', e => {
			this.viewer.dispatchEvent({
				type: 'cancel_insertions'
			});
		});

		this.sceneAnnotation = new THREE.Scene();
		this.sceneAnnotation.name = 'scene_annotation';
		this.light = new THREE.PointLight(0xffffff, 1.0);
		this.sceneAnnotation.add(this.light);

		this.viewer.inputHandler.registerInteractiveScene(this.sceneAnnotation);

		this.annotation = null;

		this.onRemove = (e) => { this.sceneAnnotation.remove(e.annotation); };
		this.onAdd = e => { this.sceneAnnotation.add(e.annotation); };
    }


    setScene (scene) {
		if (this.scene === scene) {
			return;
		}

		if (this.scene) {
			this.scene.removeEventListener('annotation_added', this.onAdd);
			this.scene.removeEventListener('annotation_removed', this.onRemove);
		}

		this.scene = scene;

		this.scene.addEventListener('annotation_added', this.onAdd);
		this.scene.addEventListener('annotation_removed', this.onRemove);
    }
    

    startInsertion (args = {}) {
		let domElement = this.viewer.renderer.domElement;

        this.annotation = new Potree.AnnotationMarker();
        //let annotation = new Potree.Annotation();

		this.dispatchEvent({
			type: 'start_inserting_annotation',
			annotation: this.annotation
		});

		this.annotation.showDistances = (args.showDistances == null) ? true : args.showDistances;
		this.annotation.showArea = args.showArea || false;
		this.annotation.showAngles = args.showAngles || false;
		this.annotation.showCoordinates = args.showCoordinates || false;
		this.annotation.showHeight = args.showHeight || false;
		this.annotation.closed = args.closed || false;
		this.annotation.maxMarkers = args.maxMarkers || Infinity;
		this.annotation.name = args.name || 'Annotation';
		
		// Handle when an annotation marker is dropped
		this.annotation.addEventListener('marker_dropped', (e)=> {
			let position = e.annotation.points[e.annotation.points.length - 1].position.clone();

			// Remove the annotationMarker
			this.sceneAnnotation.remove(this.annotation);
			this.annotation = null;
			
			
			$("#annotation-dialog button").click(() => { 
				// Add the actual annotation
				let title = $("#annotationTitle").val();
				let description = $("#annotationDescription").val();
				console.log('title= ' + title);
				console.log('description= ' + description);
				$("#annotation-dialog").dialog('close');
				this.viewer.scene.addAnnotation(position, { title: title, description: description});
			});
			$("#annotation-dialog").dialog();
			
		});
		
		this.sceneAnnotation.add(this.annotation);

		let cancel = {
			removeLastMarker: this.annotation.maxMarkers > 3,
			callback: null
		};

		let insertionCallback = (e) => {
            console.log('insertionCallback');
            if (e.button === THREE.MOUSE.LEFT) {
				// NB: This never seems to get called
                // TODO: Add a real annotation
                // -------------------------------------------
                console.log('Adding annotation');
                this.viewer.scene.addAnnotation({ title: 'Annotation 1', description: ''});
                // -------------------------------------------
/*
				annotation.addMarker(annotation.points[annotation.points.length - 1].position.clone());

				if (annotation.points.length >= annotation.maxMarkers) {
					cancel.callback();
				}

				this.viewer.inputHandler.startDragging(
                    annotation.spheres[annotation.spheres.length - 1]);
                    */
			} else if (e.button === THREE.MOUSE.RIGHT) {
				cancel.callback();
			}
		};

		cancel.callback = e => {
			if (cancel.removeLastMarker) {
				annotation.removeMarker(annotation.points.length - 1);
			}
			domElement.removeEventListener('mouseup', insertionCallback, true);
			this.viewer.removeEventListener('cancel_insertions', cancel.callback);
		};

		if (this.annotation.maxMarkers > 1) {
			this.viewer.addEventListener('cancel_insertions', cancel.callback);
			domElement.addEventListener('mouseup', insertionCallback, true);
		}

		this.annotation.addMarker(new THREE.Vector3(0, 0, 0));
		this.viewer.inputHandler.startDragging(
			this.annotation.spheres[this.annotation.spheres.length - 1]);

		//this.viewer.scene.addAnnotation(annotation);
	}
    

    update(){
		let camera = this.viewer.scene.getActiveCamera();
		let domElement = this.renderer.domElement;
		//let annotations = this.viewer.scene.getAnnotations().descendants();
        //console.log(annotations);
		this.light.position.copy(camera.position);

		let annotations = [];
		if(this.annotation != null) {
			annotations = [this.annotation];
		}

		// make size independant of distance
		for (let annotation of annotations) {
			annotation.lengthUnit = this.viewer.lengthUnit;
			annotation.update();
           
			// spheres
			for(let sphere of annotation.spheres){			
				let pr = 0;	
				if(viewer.scene.cameraMode == Potree.CameraMode.PERSPECTIVE) {
					let distance = camera.position.distanceTo(sphere.getWorldPosition());
					pr = Potree.utils.projectedRadius(1, camera.fov * Math.PI / 180, distance, domElement.clientHeight);
				} else {
					pr = Potree.utils.projectedRadiusOrtho(1, camera.projectionMatrix, domElement.clientWidth, domElement.clientHeight);
				}
				let scale = (15 / pr);
				sphere.scale.set(scale, scale, scale);
			}

			// labels
			let labels = annotation.edgeLabels.concat(annotation.angleLabels);
			for(let label of labels){
				let pr = 0;	
				if(viewer.scene.cameraMode == Potree.CameraMode.PERSPECTIVE) {
					let distance = camera.position.distanceTo(label.getWorldPosition());
					pr = Potree.utils.projectedRadius(1, camera.fov * Math.PI / 180, distance, domElement.clientHeight);
				} else {
					pr = Potree.utils.projectedRadiusOrtho(1, camera.projectionMatrix, domElement.clientWidth, domElement.clientHeight);
				}
				let scale = (70 / pr);
				label.scale.set(scale, scale, scale);
			}

			// coordinate labels
			for (let j = 0; j < annotation.coordinateLabels.length; j++) {
				let label = annotation.coordinateLabels[j];
				let sphere = annotation.spheres[j];
				// annotation.points[j]

				let distance = camera.position.distanceTo(sphere.getWorldPosition());

				let screenPos = sphere.getWorldPosition().clone().project(camera);
				screenPos.x = Math.round((screenPos.x + 1) * domElement.clientWidth / 2);
				screenPos.y = Math.round((-screenPos.y + 1) * domElement.clientHeight / 2);
				screenPos.z = 0;
				screenPos.y -= 30;

				let labelPos = new THREE.Vector3( 
					(screenPos.x / domElement.clientWidth) * 2 - 1, 
					-(screenPos.y / domElement.clientHeight) * 2 + 1, 
					0.5 );
				labelPos.unproject(camera);
				if(this.viewer.scene.cameraMode == Potree.CameraMode.PERSPECTIVE) {			                
					let direction = labelPos.sub(camera.position).normalize();
					labelPos = new THREE.Vector3().addVectors(
						camera.position, direction.multiplyScalar(distance));

				}
				label.position.copy(labelPos);
					
				let pr = 0;	
				if(viewer.scene.cameraMode == Potree.CameraMode.PERSPECTIVE) {
					pr = Potree.utils.projectedRadius(1, camera.fov * Math.PI / 180, distance, domElement.clientHeight);
				} else {
					pr = Potree.utils.projectedRadiusOrtho(1, camera.projectionMatrix, domElement.clientWidth, domElement.clientHeight);
				}

				let scale = (70 / pr);
				label.scale.set(scale, scale, scale);
			}

			// height label
			if (annotation.showHeight) {
				let label = annotation.heightLabel;

				{
					let pr = 0;	
					if(viewer.scene.cameraMode == Potree.CameraMode.PERSPECTIVE) {
						let distance = label.position.distanceTo(camera.position);
						pr = Potree.utils.projectedRadius(1, camera.fov * Math.PI / 180, distance, domElement.clientHeight);
					} else {
						pr = Potree.utils.projectedRadiusOrtho(1, camera.projectionMatrix, domElement.clientWidth, domElement.clientHeight);
					}
					let scale = (70 / pr);
					label.scale.set(scale, scale, scale);
				}

				{ // height edge
					let edge = annotation.heightEdge;
					let lowpoint = edge.geometry.vertices[0].clone().add(edge.position);
					let start = edge.geometry.vertices[2].clone().add(edge.position);
					let end = edge.geometry.vertices[3].clone().add(edge.position);

					let lowScreen = lowpoint.clone().project(camera);
					let startScreen = start.clone().project(camera);
					let endScreen = end.clone().project(camera);

					let toPixelCoordinates = v => {
						let r = v.clone().addScalar(1).divideScalar(2);
						r.x = r.x * domElement.clientWidth;
						r.y = r.y * domElement.clientHeight;
						r.z = 0;

						return r;
					};

					let lowEL = toPixelCoordinates(lowScreen);
					let startEL = toPixelCoordinates(startScreen);
					let endEL = toPixelCoordinates(endScreen);

					let lToS = lowEL.distanceTo(startEL);
					let sToE = startEL.distanceTo(endEL);

					edge.geometry.lineDistances = [0, lToS, lToS, lToS + sToE];
					edge.geometry.lineDistancesNeedUpdate = true;

					edge.material.dashSize = 10;
					edge.material.gapSize = 10;
				}
			}
			/*
			{ // area label
				let label = annnotation.areaLabel;
			
				let pr = 0;
				if(viewer.scene.cameraMode == Potree.CameraMode.PERSPECTIVE) {
					let distance = label.position.distanceTo(camera.position);
					pr = Potree.utils.projectedRadius(1, camera.fov * Math.PI / 180, distance, domElement.clientHeight);
				} else {
					pr = Potree.utils.projectedRadiusOrtho(1, camera.projectionMatrix, domElement.clientWidth, domElement.clientHeight);
				}

				let scale = (70 / pr);
				label.scale.set(scale, scale, scale);
			}*/
		}
	}
}