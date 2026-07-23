(function () {
  const AstronomyLib = window.Astronomy;
  const CesiumLib = window.Cesium;
  const CESIUM_TOKEN_STORAGE_KEY = "eclipse-scout.cesium-ion-token";
  const STARTUP_CONFIG_STORAGE_KEY = "eclipse-scout.startup-config";
  const DEFAULT_LEAFLET_BASE_MAP = "standard";
  const SCENE3D_MARKER_IMAGES = {
    observer: createScene3dMarkerSvg("observer"),
    object: createScene3dMarkerSvg("object"),
  };
  const SUN_RADIUS_KM = 695700;
  const MOON_RADIUS_KM = 1737.4;
  const KM_PER_AU = AstronomyLib ? AstronomyLib.KM_PER_AU : 149597870.7;
  const SUN_RADIUS_AU = SUN_RADIUS_KM / KM_PER_AU;
  const MOON_RADIUS_AU = MOON_RADIUS_KM / KM_PER_AU;
  const COVERAGE_EPSILON = 0.0005;
  const SOLAR_SCAN_HOURS = 8;
  const SOLAR_SCAN_STEP_MINUTES = 4;
  const SLIDER_BUFFER_MINUTES = 30;
  const EARTH_RADIUS_KM = 6371;
  const CAMERA_PRESETS = [
    { brand: "Canon", model: "EOS R5", sensorWidthMm: 36, sensorHeightMm: 24, sensorFormat: "Full frame", cropFactor: 1.0 },
    { brand: "Canon", model: "EOS 90D", sensorWidthMm: 22.3, sensorHeightMm: 14.8, sensorFormat: "Crop", cropFactor: 1.6 },
    { brand: "Nikon", model: "Z8", sensorWidthMm: 35.9, sensorHeightMm: 23.9, sensorFormat: "Full frame", cropFactor: 1.0 },
    { brand: "Nikon", model: "D7500", sensorWidthMm: 23.5, sensorHeightMm: 15.7, sensorFormat: "Crop", cropFactor: 1.5 },
    { brand: "Sony", model: "Alpha 7 IV", sensorWidthMm: 35.6, sensorHeightMm: 23.8, sensorFormat: "Full frame", cropFactor: 1.0 },
    { brand: "Sony", model: "Alpha 6700", sensorWidthMm: 23.5, sensorHeightMm: 15.6, sensorFormat: "Crop", cropFactor: 1.5 },
    { brand: "Fujifilm", model: "X-S20", sensorWidthMm: 23.5, sensorHeightMm: 15.6, sensorFormat: "Crop", cropFactor: 1.5 },
    { brand: "Fujifilm", model: "X-T5", sensorWidthMm: 23.5, sensorHeightMm: 15.6, sensorFormat: "Crop", cropFactor: 1.5 },
    { brand: "OM System", model: "OM-1", sensorWidthMm: 17.3, sensorHeightMm: 13.0, sensorFormat: "Micro 4/3", cropFactor: 2.0 },
    { brand: "Panasonic", model: "Lumix S5 II", sensorWidthMm: 35.6, sensorHeightMm: 23.8, sensorFormat: "Full frame", cropFactor: 1.0 },
    { brand: "Panasonic", model: "Lumix G9 II", sensorWidthMm: 17.3, sensorHeightMm: 13.0, sensorFormat: "Micro 4/3", cropFactor: 2.0 },
  ];
  const DEFAULT_CAMERA_PRESET = CAMERA_PRESETS[0];
  const DEFAULT_TIME_ZONE = "Europe/Lisbon";
  const FOV_RANGE_KM = 6;

  const state = {
    observer: {
      latitude: 40.4168,
      longitude: -3.7038,
      height: 667,
    },
    objectLocation: null,
    mode: "solar",
    selectedKey: "",
    selectedDateTime: new Date(),
    timeZone: DEFAULT_TIME_ZONE,
    events: {
      solar: [],
      lunar: [],
      general: [],
    },
    analysis: null,
    map: null,
    baseLayers: {
      standard: null,
      satellite: null,
    },
    baseMapMode: DEFAULT_LEAFLET_BASE_MAP,
    marker: null,
    objectMarker: null,
    objectConnectionLine: null,
    directionLines: {
      sun: null,
      moon: null,
    },
    fovLayer: null,
    scene3d: {
      viewer: null,
      observerEntity: null,
      objectEntity: null,
      sunLineEntity: null,
      moonLineEntity: null,
      fovEntity: null,
      buildingsTileset: null,
      supportsTerrain: false,
      supportsBuildings: false,
      lastObserverKey: "",
      initialized: false,
    },
    layerToggles: {
      sunLine: true,
      moonLine: true,
      fov: false,
    },
    elevationRequestIds: {
      observer: 0,
      object: 0,
    },
    camera: {
      mode: "preset",
      brand: DEFAULT_CAMERA_PRESET.brand,
      model: DEFAULT_CAMERA_PRESET.model,
      sensorWidthMm: DEFAULT_CAMERA_PRESET.sensorWidthMm,
      sensorHeightMm: DEFAULT_CAMERA_PRESET.sensorHeightMm,
      sensorFormat: DEFAULT_CAMERA_PRESET.sensorFormat,
      cropFactor: DEFAULT_CAMERA_PRESET.cropFactor,
      focalLengthMm: 600,
      targetBody: "sun",
    },
    pendingSelectedDateTime: null,
  };

  const elements = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    if (!AstronomyLib) {
      elements.statusLine.textContent = "Astronomy Engine could not be loaded. Check your internet connection and refresh.";
      elements.visibilityBadge.textContent = "Library missing";
      elements.visibilityBadge.className = "badge hidden";
      return;
    }

    populateTimeZoneOptions();
    initMap();
    init3dMap();
    bindEvents();
    hydrateCesiumTokenForm();
    buildEventCatalog();
    populateEventTypeOptions();
    applyStartupDefaultConfig();
    hydrateForm();
    hydrateCameraForm();
    populateEventOptions();
    if (state.pendingSelectedDateTime) {
      state.selectedDateTime = new Date(state.pendingSelectedDateTime.getTime());
    }
    updateMapTargetControl();
    updateConfigStatusLine();
    setLeafletBaseMap(state.baseMapMode);
    analyzeSelection();
    finalizePendingSelectedDateTime();
  }

  function cacheElements() {
    const ids = [
      "eclipseType",
      "eventSelectGroup",
      "eventSelect",
      "dateTimeInput",
      "mapTimeInput",
      "timeZoneSelect",
      "mapClickTargetSelect",
      "mapClickTargetIcon",
      "mapStyleSelect",
      "recenter2dMapButton",
      "viewerSearchInput",
      "viewerSearchButton",
      "viewerSearchResults",
      "latitudeInput",
      "longitudeInput",
      "heightInput",
      "applyLocationButton",
      "geolocateButton",
      "objectLatitudeInput",
      "objectLongitudeInput",
      "objectHeightInput",
      "objectExtraHeightInput",
      "objectPanelHeightInput",
      "objectSearchInput",
      "objectSearchButton",
      "objectSearchResults",
      "applyObjectButton",
      "removeObjectButton",
      "cameraMode",
      "cameraBrand",
      "cameraModel",
      "cameraPresetInfo",
      "sensorWidthInput",
      "sensorHeightInput",
      "manualSensorGroup",
      "sensorFormatValue",
      "cropFactorValue",
      "focalLengthInput",
      "framingBody",
      "horizontalFovValue",
      "verticalFovValue",
      "diagonalFovValue",
      "toggleSunLineButton",
      "toggleMoonLineButton",
      "toggleFovButton",
      "map3d",
      "cesiumStatusLine",
      "cesiumIonTokenInput",
      "applyCesiumTokenButton",
      "clearCesiumTokenButton",
      "eventSummary",
      "sunAzimuth",
      "sunAltitude",
      "moonAzimuth",
      "moonAltitude",
      "statusLine",
      "phaseCard",
      "phaseDisabledNote",
      "timeSlider",
      "mapTimeInput3d",
      "timeSlider3d",
      "peakCoverageButton3d",
      "recenter3dMapButton",
      "peakCoverageButton",
      "phaseSvg",
      "phaseTitle",
      "currentTimeLabel",
      "timeOffsetLabel",
      "heroCoverageLabel",
      "heroMagnitudeLabel",
      "snapshotSkySvg",
      "snapshotSkyCaption",
      "objectMetrics",
      "objectProfileSvg",
      "objectProfileLegend",
      "objectStatusLine",
      "sliderStartLabel",
      "sliderPeakLabel",
      "sliderEndLabel",
      "sliderStartLabel3d",
      "sliderPeakLabel3d",
      "sliderEndLabel3d",
      "saveConfigButton",
      "loadConfigButton",
      "loadConfigFileInput",
      "rememberLoadedConfigCheckbox",
      "clearStartupConfigButton",
      "configStatusLine",
      "heroCoverage",
      "heroMagnitude",
      "visibilityBadge",
    ];

    ids.forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    elements.eclipseType.addEventListener("change", () => {
      state.mode = elements.eclipseType.value;
      populateEventOptions();
      analyzeSelection();
    });

    elements.eventSelect.addEventListener("change", () => {
      state.selectedKey = elements.eventSelect.value;
      syncSelectedDateTimeFromEvent();
      analyzeSelection();
    });

    elements.timeZoneSelect.addEventListener("change", onTimeZoneChange);
    elements.dateTimeInput.addEventListener("change", onDateTimeInputChange);
    elements.mapTimeInput.addEventListener("change", onMapTimeInputChange);
    elements.mapTimeInput3d.addEventListener("change", onMapTimeInput3dChange);
    elements.mapClickTargetSelect.addEventListener("change", updateMapTargetControl);
    elements.mapStyleSelect.addEventListener("change", onMapStyleChange);
    elements.recenter2dMapButton.addEventListener("click", recenter2dMap);
    elements.recenter3dMapButton.addEventListener("click", () => recenter3dMap(true));
    bindSearchControls(elements.viewerSearchInput, elements.viewerSearchButton, elements.viewerSearchResults, "observer");
    bindSearchControls(elements.objectSearchInput, elements.objectSearchButton, elements.objectSearchResults, "object");

    elements.applyLocationButton.addEventListener("click", () => {
      if (!updateObserverFromInputs()) {
        return;
      }
      syncMarker();
      analyzeSelection();
    });

    elements.geolocateButton.addEventListener("click", geolocateObserver);
    elements.applyObjectButton.addEventListener("click", () => {
      if (!updateObjectFromInputs()) {
        return;
      }
      syncObjectMarker();
      refreshForSupplementaryLocation();
    });
    elements.objectPanelHeightInput.addEventListener("input", onObjectPanelHeightInput);
    elements.removeObjectButton.addEventListener("click", removeObjectLocation);
    elements.cameraMode.addEventListener("change", onCameraModeChange);
    elements.cameraBrand.addEventListener("change", onCameraBrandChange);
    elements.cameraModel.addEventListener("change", onCameraModelChange);
    elements.sensorWidthInput.addEventListener("input", updateCameraFromInputs);
    elements.sensorHeightInput.addEventListener("input", updateCameraFromInputs);
    elements.focalLengthInput.addEventListener("input", updateCameraFromInputs);
    elements.framingBody.addEventListener("change", updateCameraFromInputs);
    elements.applyCesiumTokenButton.addEventListener("click", applyCesiumIonTokenFromInput);
    elements.clearCesiumTokenButton.addEventListener("click", clearCesiumIonToken);
    elements.saveConfigButton.addEventListener("click", saveCurrentConfigToFile);
    elements.loadConfigButton.addEventListener("click", () => {
      elements.loadConfigFileInput.value = "";
      elements.loadConfigFileInput.click();
    });
    elements.loadConfigFileInput.addEventListener("change", onConfigFileSelected);
    elements.clearStartupConfigButton.addEventListener("click", clearStartupDefaultConfig);

    elements.timeSlider.addEventListener("input", () => onSharedTimeSliderInput(elements.timeSlider.value));
    elements.timeSlider3d.addEventListener("input", () => onSharedTimeSliderInput(elements.timeSlider3d.value));
    elements.peakCoverageButton.addEventListener("click", jumpToPeakCoverage);
    elements.peakCoverageButton3d.addEventListener("click", jumpToPeakCoverage);
    bindMapToggle("toggleSunLineButton", "sunLine");
    bindMapToggle("toggleMoonLineButton", "moonLine");
    bindMapToggle("toggleFovButton", "fov");
    updateMapToggleButtons();
  }

  function bindMapToggle(elementId, toggleKey) {
    elements[elementId].addEventListener("click", () => {
      state.layerToggles[toggleKey] = !state.layerToggles[toggleKey];
      updateMapToggleButtons();
      renderSnapshot();
    });
  }

  function bindSearchControls(input, button, resultsContainer, target) {
    button.addEventListener("click", () => onSearchLocation(target, input, resultsContainer));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onSearchLocation(target, input, resultsContainer);
      }
    });
  }

  function updateMapToggleButtons() {
    setToggleButtonState(elements.toggleSunLineButton, state.layerToggles.sunLine);
    setToggleButtonState(elements.toggleMoonLineButton, state.layerToggles.moonLine);
    setToggleButtonState(elements.toggleFovButton, state.layerToggles.fov);
  }

  function setToggleButtonState(button, enabled) {
    button.classList.toggle("is-on", enabled);
    button.classList.toggle("is-off", !enabled);
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
  }

  function populateTimeZoneOptions() {
    const browserTimeZone = getBrowserTimeZone();
    const options = [
      { value: DEFAULT_TIME_ZONE, label: "Lisbon (Europe/Lisbon)" },
      { value: browserTimeZone, label: `Browser local (${browserTimeZone})` },
      { value: "UTC", label: "UTC" },
    ].filter((option, index, list) => list.findIndex((candidate) => candidate.value === option.value) === index);

    elements.timeZoneSelect.innerHTML = options
      .map((option) => `<option value="${option.value}">${option.label}</option>`)
      .join("");
    elements.timeZoneSelect.value = state.timeZone;
  }

  function hydrateForm() {
    elements.latitudeInput.value = state.observer.latitude.toFixed(4);
    elements.longitudeInput.value = state.observer.longitude.toFixed(4);
    elements.heightInput.value = String(Math.round(state.observer.height));
    elements.objectLatitudeInput.value = state.objectLocation ? state.objectLocation.latitude.toFixed(4) : "";
    elements.objectLongitudeInput.value = state.objectLocation ? state.objectLocation.longitude.toFixed(4) : "";
    elements.objectHeightInput.value = state.objectLocation ? String(Math.round(state.objectLocation.height || 0)) : "";
    elements.objectExtraHeightInput.value = state.objectLocation ? String((state.objectLocation.objectHeight || 0).toFixed(1)) : "";
    elements.objectPanelHeightInput.value = state.objectLocation ? String((state.objectLocation.objectHeight || 0).toFixed(1)) : "";
    elements.timeZoneSelect.value = state.timeZone;
    elements.dateTimeInput.value = formatDateTimeLocal(state.selectedDateTime, state.timeZone);
    elements.mapTimeInput.value = formatTimeInputValue(state.selectedDateTime, state.timeZone);
    elements.mapTimeInput3d.value = formatTimeInputValue(state.selectedDateTime, state.timeZone);
    elements.mapStyleSelect.value = state.baseMapMode;
  }

  function hydrateCameraForm() {
    populateCameraBrandOptions();
    populateCameraModelOptions(state.camera.brand);
    elements.cameraMode.value = state.camera.mode;
    elements.cameraBrand.value = state.camera.brand;
    elements.cameraModel.value = state.camera.model;
    elements.sensorWidthInput.value = state.camera.sensorWidthMm.toFixed(1);
    elements.sensorHeightInput.value = state.camera.sensorHeightMm.toFixed(1);
    elements.focalLengthInput.value = String(Math.round(state.camera.focalLengthMm));
    elements.framingBody.value = state.camera.targetBody;

    const presetLocked = state.camera.mode === "preset";
    elements.cameraBrand.disabled = !presetLocked;
    elements.cameraModel.disabled = !presetLocked;
    elements.sensorWidthInput.disabled = presetLocked;
    elements.sensorHeightInput.disabled = presetLocked;
    elements.manualSensorGroup.hidden = presetLocked;
    elements.cameraPresetInfo.hidden = !presetLocked;
    elements.sensorFormatValue.textContent = state.camera.sensorFormat;
    elements.cropFactorValue.textContent = `${state.camera.cropFactor.toFixed(1)}x`;
    renderCameraMetrics();
  }

  function populateCameraBrandOptions() {
    const brands = Array.from(new Set(CAMERA_PRESETS.map((preset) => preset.brand)));
    elements.cameraBrand.innerHTML = brands
      .map((brand) => `<option value="${brand}">${brand}</option>`)
      .join("");
  }

  function populateCameraModelOptions(brand) {
    const presets = getPresetOptionsByBrand(brand);
    elements.cameraModel.innerHTML = presets
      .map((preset) => `<option value="${preset.model}">${preset.model}</option>`)
      .join("");
  }

  function getPresetOptionsByBrand(brand) {
    return CAMERA_PRESETS.filter((preset) => preset.brand === brand);
  }

  function getSelectedCameraPreset() {
    return CAMERA_PRESETS.find((preset) => preset.brand === state.camera.brand && preset.model === state.camera.model) || null;
  }

  function applyCameraPreset(preset) {
    state.camera.brand = preset.brand;
    state.camera.model = preset.model;
    state.camera.sensorWidthMm = preset.sensorWidthMm;
    state.camera.sensorHeightMm = preset.sensorHeightMm;
    state.camera.sensorFormat = preset.sensorFormat;
    state.camera.cropFactor = preset.cropFactor;
  }

  function onCameraModeChange() {
    state.camera.mode = elements.cameraMode.value;
    if (state.camera.mode === "preset") {
      applyCameraPreset(getSelectedCameraPreset() || DEFAULT_CAMERA_PRESET);
    }
    hydrateCameraForm();
    renderSnapshot();
  }

  function onCameraBrandChange() {
    state.camera.brand = elements.cameraBrand.value;
    populateCameraModelOptions(state.camera.brand);
    const nextPreset = getPresetOptionsByBrand(state.camera.brand)[0] || DEFAULT_CAMERA_PRESET;
    applyCameraPreset(nextPreset);
    hydrateCameraForm();
    renderSnapshot();
  }

  function onCameraModelChange() {
    state.camera.model = elements.cameraModel.value;
    applyCameraPreset(getSelectedCameraPreset() || DEFAULT_CAMERA_PRESET);
    hydrateCameraForm();
    renderSnapshot();
  }

  function updateCameraFromInputs() {
    state.camera.targetBody = elements.framingBody.value;

    const focalLengthMm = Number(elements.focalLengthInput.value);
    if (Number.isFinite(focalLengthMm) && focalLengthMm > 0) {
      state.camera.focalLengthMm = focalLengthMm;
    }

    if (state.camera.mode === "manual") {
      const sensorWidthMm = Number(elements.sensorWidthInput.value);
      const sensorHeightMm = Number(elements.sensorHeightInput.value);

      if (Number.isFinite(sensorWidthMm) && sensorWidthMm > 0) {
        state.camera.sensorWidthMm = sensorWidthMm;
      }
      if (Number.isFinite(sensorHeightMm) && sensorHeightMm > 0) {
        state.camera.sensorHeightMm = sensorHeightMm;
      }

      state.camera.sensorFormat = classifySensorFormat(state.camera.sensorWidthMm);
      state.camera.cropFactor = computeCropFactor(state.camera.sensorWidthMm);
    }

    hydrateCameraForm();
    renderCameraMetrics();
    renderSnapshot();
  }

  function renderCameraMetrics() {
    const fov = computeFieldOfView(
      state.camera.sensorWidthMm,
      state.camera.sensorHeightMm,
      state.camera.focalLengthMm
    );
    elements.horizontalFovValue.textContent = formatAngle(fov.horizontalDeg);
    elements.verticalFovValue.textContent = formatAngle(fov.verticalDeg);
    elements.diagonalFovValue.textContent = formatAngle(fov.diagonalDeg);
  }

  function updateObserverFromInputs() {
    const latitude = Number(elements.latitudeInput.value);
    const longitude = Number(elements.longitudeInput.value);
    const height = Number(elements.heightInput.value || 0);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      elements.statusLine.textContent = "Latitude must be between -90 and 90.";
      return false;
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      elements.statusLine.textContent = "Longitude must be between -180 and 180.";
      return false;
    }

    state.observer = { latitude, longitude, height: Number.isFinite(height) ? height : 0 };
    hydrateForm();
    return true;
  }

  function updateObjectFromInputs() {
    const latitude = Number(elements.objectLatitudeInput.value);
    const longitude = Number(elements.objectLongitudeInput.value);
    const height = Number(elements.objectHeightInput.value || 0);
    const objectHeight = Number(elements.objectExtraHeightInput.value || 0);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      elements.objectStatusLine.textContent = "Object latitude must be between -90 and 90.";
      return false;
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      elements.objectStatusLine.textContent = "Object longitude must be between -180 and 180.";
      return false;
    }

    state.objectLocation = {
      latitude,
      longitude,
      height: Number.isFinite(height) ? height : 0,
      objectHeight: Number.isFinite(objectHeight) && objectHeight >= 0 ? objectHeight : 0,
      label: state.objectLocation?.label || "Object reference",
    };
    hydrateForm();
    return true;
  }

  function removeObjectLocation() {
    state.objectLocation = null;
    hydrateForm();
    syncObjectMarker();
    refreshForSupplementaryLocation();
  }

  function onObjectPanelHeightInput() {
    if (!state.objectLocation) {
      return;
    }

    const objectHeight = Number(elements.objectPanelHeightInput.value || 0);
    state.objectLocation.objectHeight = Number.isFinite(objectHeight) && objectHeight >= 0 ? objectHeight : 0;
    elements.objectExtraHeightInput.value = String(state.objectLocation.objectHeight.toFixed(1));
    refreshForSupplementaryLocation();
  }

  function refreshForSupplementaryLocation() {
    if (state.analysis) {
      renderSnapshot();
    } else {
      analyzeSelection();
    }
  }

  function geolocateObserver() {
    if (!navigator.geolocation) {
      elements.statusLine.textContent = "This browser does not support geolocation.";
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        state.observer = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          height: Number.isFinite(position.coords.altitude) ? position.coords.altitude : state.observer.height,
        };
        hydrateForm();
        syncMarker();
        analyzeSelection();
        if (!Number.isFinite(position.coords.altitude)) {
          refreshLocationElevation("observer");
        }
      },
      () => {
        elements.statusLine.textContent = "Geolocation was blocked or failed. You can still drag the map pin manually.";
      },
      {
        enableHighAccuracy: true,
        maximumAge: 300000,
        timeout: 10000,
      }
    );
  }

  function initMap() {
    state.map = L.map("map", {
      zoomControl: true,
      worldCopyJump: true,
    }).setView([state.observer.latitude, state.observer.longitude], 4);

    state.baseLayers.standard = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    });
    state.baseLayers.satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri",
    });
    setLeafletBaseMap(state.baseMapMode);

    state.marker = L.marker([state.observer.latitude, state.observer.longitude], {
      draggable: true,
    }).addTo(state.map);

    state.marker.on("dragend", () => {
      const point = state.marker.getLatLng();
      state.observer.latitude = point.lat;
      state.observer.longitude = point.lng;
      hydrateForm();
      analyzeSelection();
      refreshLocationElevation("observer");
    });

    state.map.on("click", (event) => {
      if ((elements.mapClickTargetSelect.value || "observer") === "observer") {
        state.observer.latitude = event.latlng.lat;
        state.observer.longitude = event.latlng.lng;
        hydrateForm();
        syncMarker();
        analyzeSelection();
        refreshLocationElevation("observer");
        return;
      }

      state.objectLocation = {
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
        height: state.objectLocation?.height || 0,
        objectHeight: state.objectLocation?.objectHeight || 0,
        label: state.objectLocation?.label || "Object reference",
      };
      hydrateForm();
      syncObjectMarker();
      refreshForSupplementaryLocation();
      refreshLocationElevation("object");
    });
  }

  function setLeafletBaseMap(mode) {
    state.baseMapMode = mode === "satellite" ? "satellite" : DEFAULT_LEAFLET_BASE_MAP;
    if (!state.map) {
      return;
    }

    Object.entries(state.baseLayers).forEach(([, layer]) => {
      if (layer && state.map.hasLayer(layer)) {
        state.map.removeLayer(layer);
      }
    });

    const nextLayer = state.baseLayers[state.baseMapMode] || state.baseLayers.standard;
    if (nextLayer) {
      nextLayer.addTo(state.map);
    }
    if (elements.mapStyleSelect) {
      elements.mapStyleSelect.value = state.baseMapMode;
    }
  }

  function onMapStyleChange() {
    setLeafletBaseMap(elements.mapStyleSelect.value);
  }

  function updateMapTargetControl() {
    const target = elements.mapClickTargetSelect.value || "observer";
    if (elements.mapClickTargetIcon) {
      elements.mapClickTargetIcon.textContent = target === "observer" ? "◎" : "◆";
      elements.mapClickTargetIcon.setAttribute("title", target === "observer" ? "Observer" : "Object");
    }
  }

  function init3dMap() {
    if (!elements.map3d || !elements.cesiumStatusLine) {
      return;
    }

    if (!CesiumLib) {
      elements.cesiumStatusLine.textContent = "Cesium could not be loaded. Check your internet connection and refresh.";
      return;
    }

    try {
      const ionToken = readCesiumIonToken();
      if (ionToken) {
        CesiumLib.Ion.defaultAccessToken = ionToken;
      }

      const viewer = new CesiumLib.Viewer("map3d", {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        shouldAnimate: false,
        timeline: false,
        terrainProvider: new CesiumLib.EllipsoidTerrainProvider(),
        imageryProvider: new CesiumLib.OpenStreetMapImageryProvider({
          url: "https://tile.openstreetmap.org/",
        }),
      });

      viewer.clock.shouldAnimate = false;
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.dynamicAtmosphereLighting = true;
      viewer.scene.globe.dynamicAtmosphereLightingFromSun = true;
      viewer.scene.globe.showGroundAtmosphere = true;
      viewer.scene.globe.depthTestAgainstTerrain = true;
      viewer.scene.globe.maximumScreenSpaceError = 1.25;
      viewer.scene.globe.tileCacheSize = 1200;
      viewer.scene.globe.preloadAncestors = true;
      viewer.scene.globe.preloadSiblings = true;
      viewer.scene.sun.show = true;
      viewer.scene.moon.show = true;
      viewer.shadows = true;
      viewer.scene.shadowMap.enabled = true;
      viewer.scene.requestRenderMode = true;
      viewer.scene.maximumRenderTimeChange = Infinity;
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 150;
      viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 2);

      state.scene3d.viewer = viewer;
      state.scene3d.initialized = true;
      elements.cesiumStatusLine.textContent = ionToken
        ? "3D globe ready. Attempting to load terrain and buildings."
        : "3D globe ready with open imagery and solar lighting. Add window.CESIUM_ION_TOKEN for terrain and buildings.";

      window.addEventListener("resize", () => {
        if (state.scene3d.viewer && !state.scene3d.viewer.isDestroyed()) {
          state.scene3d.viewer.scene.requestRender();
        }
      });

      if (ionToken) {
        void enableCesiumEnhancements();
      }
    } catch (error) {
      console.error("Failed to initialize Cesium viewer.", error);
      elements.cesiumStatusLine.textContent = "3D globe failed to initialize in this browser.";
    }
  }

  function hydrateCesiumTokenForm() {
    if (!elements.cesiumIonTokenInput) {
      return;
    }

    elements.cesiumIonTokenInput.value = readCesiumIonToken();
  }

  function readCesiumIonToken() {
    const directToken = typeof window.CESIUM_ION_TOKEN === "string" ? window.CESIUM_ION_TOKEN.trim() : "";
    if (directToken) {
      return directToken;
    }

    const storedToken = readStoredCesiumIonToken();
    if (storedToken) {
      return storedToken;
    }

    const metaTag = document.querySelector('meta[name="cesium-ion-token"]');
    const metaToken = metaTag?.getAttribute("content")?.trim() || "";
    if (metaToken) {
      return metaToken;
    }

    return "";
  }

  function readStoredCesiumIonToken() {
    try {
      return window.localStorage.getItem(CESIUM_TOKEN_STORAGE_KEY)?.trim() || "";
    } catch (error) {
      console.warn("Could not read the saved Cesium ion token.", error);
      return "";
    }
  }

  function persistCesiumIonToken(token) {
    try {
      if (token) {
        window.localStorage.setItem(CESIUM_TOKEN_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(CESIUM_TOKEN_STORAGE_KEY);
      }
      return true;
    } catch (error) {
      console.warn("Could not persist the Cesium ion token.", error);
      return false;
    }
  }

  async function applyCesiumIonTokenFromInput() {
    const token = elements.cesiumIonTokenInput?.value?.trim() || "";
    if (!token) {
      elements.cesiumStatusLine.textContent = "Paste a Cesium ion token first, then enable terrain and buildings.";
      return;
    }

    if (!persistCesiumIonToken(token)) {
      elements.cesiumStatusLine.textContent = "The token could not be stored in this browser. Check private mode or browser storage settings.";
      return;
    }

    if (!CesiumLib || !state.scene3d.viewer || state.scene3d.viewer.isDestroyed()) {
      elements.cesiumStatusLine.textContent = "Token saved. Reload the page to finish enabling terrain and buildings.";
      return;
    }

    CesiumLib.Ion.defaultAccessToken = token;
    elements.cesiumStatusLine.textContent = "Token saved. Loading terrain and buildings.";
    await enableCesiumEnhancements();
    if (state.analysis) {
      renderSnapshot();
    }
  }

  function clearCesiumIonToken() {
    persistCesiumIonToken("");
    if (elements.cesiumIonTokenInput) {
      elements.cesiumIonTokenInput.value = "";
    }
    resetCesiumEnhancements();
    elements.cesiumStatusLine.textContent = "Token cleared. The 3D panel is back to the open imagery fallback without terrain or buildings.";
    if (state.analysis) {
      renderSnapshot();
    }
  }

  async function enableCesiumEnhancements() {
    if (!state.scene3d.viewer || !CesiumLib) {
      return;
    }

    if (state.scene3d.supportsTerrain && state.scene3d.supportsBuildings) {
      elements.cesiumStatusLine.textContent = "3D globe ready with terrain and buildings.";
      return;
    }

    try {
      state.scene3d.viewer.terrainProvider = await CesiumLib.createWorldTerrainAsync({
        requestVertexNormals: true,
        requestWaterMask: true,
      });
      state.scene3d.supportsTerrain = true;
    } catch (error) {
      console.warn("Cesium terrain could not be loaded.", error);
    }

    try {
      state.scene3d.buildingsTileset = await CesiumLib.createOsmBuildingsAsync();
      state.scene3d.buildingsTileset.maximumScreenSpaceError = 1;
      state.scene3d.buildingsTileset.skipLevelOfDetail = false;
      state.scene3d.buildingsTileset.dynamicScreenSpaceError = false;
      state.scene3d.buildingsTileset.immediatelyLoadDesiredLevelOfDetail = true;
      state.scene3d.buildingsTileset.preloadWhenHidden = true;
      state.scene3d.buildingsTileset.preloadFlightDestinations = true;
      state.scene3d.viewer.scene.primitives.add(state.scene3d.buildingsTileset);
      state.scene3d.supportsBuildings = true;
    } catch (error) {
      console.warn("Cesium OSM buildings could not be loaded.", error);
    }

    elements.cesiumStatusLine.textContent = state.scene3d.supportsTerrain || state.scene3d.supportsBuildings
      ? `3D globe ready${state.scene3d.supportsTerrain ? " with terrain" : ""}${state.scene3d.supportsBuildings ? `${state.scene3d.supportsTerrain ? " and" : " with"} buildings` : ""}.`
      : "3D globe ready with open imagery and solar lighting. Terrain and buildings need a valid Cesium ion token.";
  }

  function resetCesiumEnhancements() {
    const viewer = state.scene3d.viewer;
    if (!viewer || viewer.isDestroyed() || !CesiumLib) {
      return;
    }

    viewer.terrainProvider = new CesiumLib.EllipsoidTerrainProvider();
    if (state.scene3d.buildingsTileset) {
      viewer.scene.primitives.remove(state.scene3d.buildingsTileset);
      state.scene3d.buildingsTileset = null;
    }
    state.scene3d.supportsTerrain = false;
    state.scene3d.supportsBuildings = false;
    viewer.scene.requestRender();
  }

  function syncMarker() {
    if (!state.marker || !state.map) {
      return;
    }
    state.marker.setLatLng([state.observer.latitude, state.observer.longitude]);
    state.map.panTo([state.observer.latitude, state.observer.longitude], { animate: true });
  }

  function recenter2dMap() {
    if (!state.map) {
      return;
    }

    state.map.setView([state.observer.latitude, state.observer.longitude], Math.max(state.map.getZoom(), 10), {
      animate: true,
    });
  }

  function syncObjectMarker() {
    if (!state.map) {
      return;
    }

    if (!state.objectLocation) {
      removeMapLayer(state.objectMarker);
      state.objectMarker = null;
      removeMapLayer(state.objectConnectionLine);
      state.objectConnectionLine = null;
      return;
    }

    const latLng = [state.objectLocation.latitude, state.objectLocation.longitude];
    if (!state.objectMarker) {
      state.objectMarker = L.marker(latLng, {
        draggable: true,
        icon: L.divIcon({ className: "object-marker", iconSize: [18, 18], iconAnchor: [9, 9] }),
      }).addTo(state.map);
      state.objectMarker.on("dragend", () => {
        const point = state.objectMarker.getLatLng();
        if (!state.objectLocation) {
          return;
        }
        state.objectLocation.latitude = point.lat;
        state.objectLocation.longitude = point.lng;
        hydrateForm();
        refreshForSupplementaryLocation();
        refreshLocationElevation("object");
      });
    } else {
      state.objectMarker.setLatLng(latLng);
    }

    if (!state.objectConnectionLine) {
      state.objectConnectionLine = L.polyline([
        [state.observer.latitude, state.observer.longitude],
        latLng,
      ], {
        color: "#5779ba",
        weight: 2,
        opacity: 0.65,
        dashArray: "6 8",
      }).addTo(state.map);
    } else {
      state.objectConnectionLine.setLatLngs([
        [state.observer.latitude, state.observer.longitude],
        latLng,
      ]);
    }
  }

  function buildEventCatalog() {
    const start = new Date();
    state.events.solar = buildSolarEvents(start, 8);
    state.events.lunar = buildLunarEvents(start, 8);
    state.events.general = [{
      key: "general-now",
      label: "Sun and Moon planning window",
      peakDate: start,
      kind: "planning",
      ref: null,
    }];
  }

  function buildSolarEvents(startDate, count) {
    const events = [];
    let event = AstronomyLib.SearchGlobalSolarEclipse(startDate);

    for (let index = 0; index < count && event; index += 1) {
      events.push({
        key: `solar-${event.peak.ut.toFixed(6)}`,
        label: `${formatDate(event.peak.date)} · ${capitalize(String(event.kind))}`,
        peakDate: event.peak.date,
        peakAstro: event.peak,
        kind: String(event.kind),
        ref: event,
      });
      event = AstronomyLib.NextGlobalSolarEclipse(event.peak);
    }

    return events;
  }

  function buildLunarEvents(startDate, count) {
    const events = [];
    let event = AstronomyLib.SearchLunarEclipse(startDate);

    for (let index = 0; index < count && event; index += 1) {
      events.push({
        key: `lunar-${event.peak.ut.toFixed(6)}`,
        label: `${formatDate(event.peak.date)} · ${capitalize(String(event.kind))}`,
        peakDate: event.peak.date,
        peakAstro: event.peak,
        kind: String(event.kind),
        ref: event,
      });
      event = AstronomyLib.NextLunarEclipse(event.peak);
    }

    return events;
  }

  function populateEventTypeOptions() {
    elements.eclipseType.innerHTML = [
      { value: "solar", label: "Solar eclipse" },
      { value: "lunar", label: "Lunar eclipse" },
      { value: "general", label: "Only sun and moon" },
    ].map((option) => `<option value="${option.value}">${option.label}</option>`).join("");
    elements.eclipseType.value = state.mode;
  }

  function populateEventOptions() {
    const options = state.events[state.mode];
    const showEventSelection = state.mode !== "general";
    elements.eventSelectGroup.hidden = !showEventSelection;
    elements.eventSelect.disabled = !showEventSelection;
    elements.eventSelect.innerHTML = options
      .map((event) => `<option value="${event.key}">${event.label}</option>`)
      .join("");

    if (!options.length) {
      state.selectedKey = "";
      return;
    }

    if (!options.some((event) => event.key === state.selectedKey)) {
      state.selectedKey = options[0].key;
    }

    elements.eventSelect.value = state.selectedKey;
    syncSelectedDateTimeFromEvent();
    elements.dateTimeInput.value = formatDateTimeLocal(state.selectedDateTime, state.timeZone);
  }

  function analyzeSelection() {
    const event = getSelectedEvent();
    if (!event) {
      return;
    }

    elements.statusLine.textContent = state.mode === "general"
      ? "Calculating Sun and Moon positions..."
      : "Calculating local eclipse geometry...";

    if (state.mode === "solar") {
      state.analysis = analyzeSolarEvent(event.ref, state.observer);
    } else if (state.mode === "lunar") {
      state.analysis = analyzeLunarEvent(event.ref, state.observer);
    } else {
      state.analysis = analyzeGeneralObservation(state.observer, state.selectedDateTime);
    }

    configureSlider();
    renderEventSummary(event, state.analysis);
    renderSnapshot();
  }

  function getSelectedEvent() {
    return state.events[state.mode].find((event) => event.key === state.selectedKey) || null;
  }

  function analyzeSolarEvent(globalEvent, observerInput) {
    const observer = makeObserver(observerInput);
    const center = globalEvent.peak.date;
    const dayRange = getLocalDayRange(state.selectedDateTime);
    const samples = [];
    const start = new Date(center.getTime() - SOLAR_SCAN_HOURS * 3600000);
    const end = new Date(center.getTime() + SOLAR_SCAN_HOURS * 3600000);
    let peakSample = null;

    for (let minuteOffset = -SOLAR_SCAN_HOURS * 60; minuteOffset <= SOLAR_SCAN_HOURS * 60; minuteOffset += SOLAR_SCAN_STEP_MINUTES) {
      const sampleDate = addMinutes(center, minuteOffset);
      const sample = makeSolarSnapshot(sampleDate, observer);
      samples.push(sample);
      if (!peakSample || sample.coverage > peakSample.coverage) {
        peakSample = sample;
      }
    }

    if (peakSample && peakSample.coverage > COVERAGE_EPSILON) {
      peakSample = refineSolarPeak(peakSample.time, observer);
    } else if (peakSample) {
      peakSample = makeSolarSnapshot(center, observer);
    }

    const visibleSamples = samples.filter((sample) => sample.coverage > COVERAGE_EPSILON);
    const visible = visibleSamples.length > 0;

    return {
      type: "solar",
      event: globalEvent,
      observer,
      visible,
      peak: peakSample,
      rangeStart: dayRange.start,
      rangeEnd: dayRange.end,
      peakReference: peakSample.time,
      globalStart: start,
      globalEnd: end,
      samples,
      message: visible
        ? `Local maximum coverage occurs ${formatTimeWithZone(peakSample.time, state.timeZone)} with the Sun at ${formatAngle(peakSample.sunHorizon.altitude)} altitude.`
        : "This global eclipse is not visible from the selected pin. The slider stays centered on the global peak time.",
    };
  }

  function analyzeLunarEvent(lunarEvent, observerInput) {
    const observer = makeObserver(observerInput);
    const peak = lunarEvent.peak.date;
    const dayRange = getLocalDayRange(state.selectedDateTime);
    const penumbralSemiMinutes = Math.max(Number(lunarEvent.sd_penum) || 120, 90);
    const partialSemiMinutes = Math.max(Number(lunarEvent.sd_partial) || 0, 0);
    const totalSemiMinutes = Math.max(Number(lunarEvent.sd_total) || 0, 0);
    const peakSnapshot = makeLunarSnapshot(peak, lunarEvent, observer, {
      penumbralSemiMinutes,
      partialSemiMinutes,
      totalSemiMinutes,
    });

    return {
      type: "lunar",
      event: lunarEvent,
      observer,
      visible: peakSnapshot.moonHorizon.altitude > 0,
      peak: peakSnapshot,
      rangeStart: dayRange.start,
      rangeEnd: dayRange.end,
      peakReference: peak,
      penumbralSemiMinutes,
      partialSemiMinutes,
      totalSemiMinutes,
      message: peakSnapshot.moonHorizon.altitude > 0
        ? `Peak eclipse occurs ${formatTimeWithZone(peak, state.timeZone)} with the Moon at ${formatAngle(peakSnapshot.moonHorizon.altitude)} altitude.`
        : "The eclipse is geometrically occurring, but the Moon is below the horizon at the selected pin near peak.",
    };
  }

  function analyzeGeneralObservation(observerInput, centerDate) {
    const observer = makeObserver(observerInput);
    const center = new Date(centerDate.getTime());
    const dayRange = getLocalDayRange(center);
    const referenceSnapshot = makeSolarSnapshot(center, observer);

    return {
      type: "general",
      observer,
      visible: referenceSnapshot.sunHorizon.altitude > 0 || referenceSnapshot.moonHorizon.altitude > 0,
      peak: referenceSnapshot,
      rangeStart: dayRange.start,
      rangeEnd: dayRange.end,
      peakReference: center,
      message: "General Sun and Moon planning mode uses the full selected local day.",
    };
  }

  function configureSlider() {
    if (!state.analysis) {
      return;
    }

    const durationMinutes = Math.max(
      0,
      Math.round((state.analysis.rangeEnd.getTime() - state.analysis.rangeStart.getTime()) / 60000)
    );
    const desiredTime = clampDate(state.selectedDateTime, state.analysis.rangeStart, state.analysis.rangeEnd);
    const peakPosition = Math.max(
      0,
      Math.round((desiredTime.getTime() - state.analysis.rangeStart.getTime()) / 60000)
    );

    elements.timeSlider.min = "0";
    elements.timeSlider.max = String(durationMinutes);
    elements.timeSlider.value = String(peakPosition);
    elements.timeSlider3d.min = "0";
    elements.timeSlider3d.max = String(durationMinutes);
    elements.timeSlider3d.value = String(peakPosition);
    elements.sliderStartLabel.textContent = formatClockTime(state.analysis.rangeStart, state.timeZone);
    elements.sliderPeakLabel.textContent = formatClockTime(addMinutes(state.analysis.rangeStart, Math.round(durationMinutes / 2)), state.timeZone);
    elements.sliderEndLabel.textContent = formatClockTime(state.analysis.rangeEnd, state.timeZone);
    elements.sliderStartLabel3d.textContent = elements.sliderStartLabel.textContent;
    elements.sliderPeakLabel3d.textContent = elements.sliderPeakLabel.textContent;
    elements.sliderEndLabel3d.textContent = elements.sliderEndLabel.textContent;
  }

  function renderEventSummary(event, analysis) {
    const rows = [];
    rows.push(["Mode", state.mode === "general" ? "Only sun and moon" : capitalize(state.mode)]);

    if (state.mode !== "general") {
      rows.push(["Class", capitalize(String(event.kind))]);
      rows.push(["Peak time", formatTimeWithZone(event.peakDate, state.timeZone)]);
    } else {
      rows.push(["Window center", formatTimeWithZone(analysis.peakReference, state.timeZone)]);
      rows.push(["Window span", formatDurationMinutes((analysis.rangeEnd.getTime() - analysis.rangeStart.getTime()) / 60000)]);
    }

    if (state.mode === "solar") {
      rows.push(["Global peak shadow", formatLatLonPair(event.ref.latitude, event.ref.longitude)]);
      rows.push(["Local max coverage", formatPercent(analysis.peak.coverage)]);
      rows.push(["Local max magnitude", analysis.peak.magnitude.toFixed(3)]);
    } else if (state.mode === "lunar") {
      rows.push(["Peak obscuration", formatPercent(Number(event.ref.obscuration) || 0)]);
      rows.push(["Penumbral span", formatDurationMinutes(analysis.penumbralSemiMinutes * 2)]);
      rows.push(["Total span", analysis.totalSemiMinutes > 0 ? formatDurationMinutes(analysis.totalSemiMinutes * 2) : "None"]);
    } else {
      rows.push(["Target body", capitalize(state.camera.targetBody)]);
      rows.push(["Camera", `${state.camera.brand} ${state.camera.model}`]);
    }

    rows.push(["Observer", `${state.observer.latitude.toFixed(2)}, ${state.observer.longitude.toFixed(2)}`]);
    rows.push(["Elevation", `${Math.round(state.observer.height)} m`]);
    rows.push(["Time zone", state.timeZone]);

    elements.eventSummary.innerHTML = rows
      .map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`)
      .join("");
  }

  function renderSnapshot() {
    if (!state.analysis) {
      return;
    }

    const sliderMinutes = Number(elements.timeSlider.value);
    const currentTime = addMinutes(state.analysis.rangeStart, sliderMinutes);
    state.selectedDateTime = new Date(currentTime.getTime());
    elements.dateTimeInput.value = formatDateTimeLocal(currentTime, state.timeZone);
    elements.mapTimeInput.value = formatTimeInputValue(currentTime, state.timeZone);
    elements.mapTimeInput3d.value = formatTimeInputValue(currentTime, state.timeZone);
    elements.timeSlider.value = String(sliderMinutes);
    elements.timeSlider3d.value = String(sliderMinutes);
    let snapshot;

    if (state.analysis.type === "solar" || state.analysis.type === "general") {
      snapshot = makeSolarSnapshot(currentTime, state.analysis.observer);
    } else {
      snapshot = makeLunarSnapshot(currentTime, state.analysis.event, state.analysis.observer, state.analysis);
    }

    const objectSnapshot = state.objectLocation ? makeLocationSnapshot(currentTime, state.objectLocation) : null;

    renderMetrics(snapshot, currentTime);
    renderPhase(snapshot);
    renderSkyInfographic(snapshot, currentTime);
    renderObjectComparison(snapshot, objectSnapshot, currentTime);
    renderMap(snapshot, objectSnapshot, currentTime);
    elements.statusLine.textContent = state.analysis.message;
  }

  function jumpToPeakCoverage() {
    if (state.mode === "general" || !state.analysis || !state.analysis.peak || !state.analysis.peak.time) {
      return;
    }

    const peakMinutes = Math.round(
      (state.analysis.peak.time.getTime() - state.analysis.rangeStart.getTime()) / 60000
    );
    const min = Number(elements.timeSlider.min);
    const max = Number(elements.timeSlider.max);
    elements.timeSlider.value = String(clamp(peakMinutes, min, max));
    renderSnapshot();
  }

  function renderMetrics(snapshot, currentTime) {
    elements.currentTimeLabel.textContent = formatTimeWithZone(currentTime, state.timeZone);
    elements.timeOffsetLabel.textContent = state.analysis.type === "general"
      ? `Selected day ${formatDate(currentTime, state.timeZone)}`
      : `Peak at ${formatClockTime(state.analysis.peakReference, state.timeZone)}`;
    elements.phaseTitle.textContent = state.analysis.type === "solar"
      ? "Solar eclipse alignment"
      : state.analysis.type === "lunar"
        ? "Lunar eclipse shadow crossing"
        : "Sun and Moon alignment preview";

    if (state.analysis.type === "general") {
      elements.heroCoverage.textContent = formatAngle(snapshot.sunHorizon.altitude);
      elements.heroCoverageLabel.textContent = "sun altitude";
      elements.heroMagnitude.textContent = formatAngle(snapshot.moonHorizon.altitude);
      elements.heroMagnitudeLabel.textContent = "moon altitude";
    } else {
      elements.heroCoverage.textContent = formatPercent(snapshot.coverage);
      elements.heroCoverageLabel.textContent = "coverage";
      elements.heroMagnitude.textContent = snapshot.magnitude.toFixed(3);
      elements.heroMagnitudeLabel.textContent = "magnitude";
    }

    elements.peakCoverageButton.disabled = state.analysis.type === "general";
    elements.peakCoverageButton.hidden = state.analysis.type === "general";
    elements.peakCoverageButton3d.disabled = state.analysis.type === "general";
    elements.peakCoverageButton3d.hidden = state.analysis.type === "general";
    elements.phaseDisabledNote.hidden = state.analysis.type !== "general";
    elements.phaseCard.classList.toggle("is-disabled", state.analysis.type === "general");
    elements.phaseCard.setAttribute("aria-disabled", state.analysis.type === "general" ? "true" : "false");

    const visibleNow = state.analysis.type === "solar"
      ? snapshot.coverage > COVERAGE_EPSILON && snapshot.sunHorizon.altitude > 0
      : state.analysis.type === "lunar"
        ? snapshot.moonHorizon.altitude > 0
        : snapshot.sunHorizon.altitude > 0 || snapshot.moonHorizon.altitude > 0;

    elements.visibilityBadge.textContent = visibleNow ? "Visible above horizon" : "Below horizon or not visible";
    elements.visibilityBadge.className = `badge ${visibleNow ? "visible" : "hidden"}`;

    elements.sunAzimuth.textContent = formatAngle(snapshot.sunHorizon.azimuth);
    elements.sunAltitude.textContent = formatAngle(snapshot.sunHorizon.altitude);
    elements.moonAzimuth.textContent = formatAngle(snapshot.moonHorizon.azimuth);
    elements.moonAltitude.textContent = formatAngle(snapshot.moonHorizon.altitude);
  }

  function onTimeZoneChange() {
    state.timeZone = elements.timeZoneSelect.value || DEFAULT_TIME_ZONE;
    hydrateForm();
    analyzeSelection();
  }

  function onDateTimeInputChange() {
    const nextDate = parseDateTimeLocal(elements.dateTimeInput.value, state.timeZone);
    if (!nextDate) {
      return;
    }

    state.selectedDateTime = nextDate;
    analyzeSelection();
  }

  function onMapTimeInputChange() {
    onSharedMapTimeInputChange(elements.mapTimeInput.value);
  }

  function onMapTimeInput3dChange() {
    onSharedMapTimeInputChange(elements.mapTimeInput3d.value);
  }

  function onSharedMapTimeInputChange(timeValue) {
    if (!timeValue) {
      return;
    }

    const parts = getZonedDateParts(state.selectedDateTime, state.timeZone);
    const nextDate = parseDateTimeLocal(`${parts.year}-${parts.month}-${parts.day}T${timeValue}`, state.timeZone);
    if (!nextDate) {
      return;
    }

    state.selectedDateTime = nextDate;
    syncSliderToSelectedDateTime();
    renderSnapshot();
  }

  function onSharedTimeSliderInput(value) {
    elements.timeSlider.value = String(value);
    elements.timeSlider3d.value = String(value);
    renderSnapshot();
  }

  function syncSelectedDateTimeFromEvent() {
    if (state.mode === "general") {
      return;
    }

    const event = getSelectedEvent();
    if (!event || !event.peakDate) {
      return;
    }

    state.selectedDateTime = new Date(event.peakDate.getTime());
  }

  function renderObjectComparison(viewerSnapshot, objectSnapshot, currentTime) {
    if (!state.objectLocation || !objectSnapshot) {
      elements.objectMetrics.innerHTML = [
        ["1. Linear distance between observer and object", "--"],
        ["2. Elevation of observer above sea level", "--"],
        ["3. Elevation of object above sea level excluding object height", "--"],
        ["4. Elevation of the Sun above sea level", "--"],
        ["5. Elevation of the Moon above sea level", "--"],
        ["6. Delta elevation of the object relative to the observer excluding object height", "--"],
        ["7. Delta elevation of the object relative to the observer including object height", "--"],
        ["8. Delta elevation of the Sun relative to the observer", "--"],
        ["9. Delta elevation of the Moon relative to the observer", "--"],
        ["10. Delta elevation of the Sun relative to the object including object height", "--"],
        ["11. Delta elevation of the Moon relative to the object including object height", "--"],
      ].map(([label, value]) => `<div><span class="sky-label">${label}</span><strong>${value}</strong></div>`).join("");
      elements.objectProfileSvg.innerHTML = "";
      elements.objectProfileLegend.innerHTML = "";
      elements.objectStatusLine.textContent = "Add an object location to compare it against the observer position.";
      return;
    }

    const distanceKm = computeDistanceKm(state.observer, state.objectLocation);
    const groundBearingDeg = computeBearingDeg(state.observer, state.objectLocation);
    const observerElevationM = state.observer.height || 0;
    const objectGroundElevationM = state.objectLocation.height || 0;
    const objectHeightM = state.objectLocation.objectHeight || 0;
    const totalObjectElevationM = (state.objectLocation.height || 0) + (state.objectLocation.objectHeight || 0);
    const objectDeltaExcludingHeightM = objectGroundElevationM - observerElevationM;
    const objectDeltaIncludingHeightM = totalObjectElevationM - observerElevationM;
    const slopeDeg = radToDeg(Math.atan2(objectDeltaIncludingHeightM, Math.max(distanceKm * 1000, 1)));
    const linearDistanceKm = Math.sqrt(distanceKm * distanceKm + Math.pow(objectDeltaIncludingHeightM / 1000, 2));
    const sunAzimuthDeltaDeg = normalizeAngleDelta(viewerSnapshot.sunHorizon.azimuth - groundBearingDeg);
    const moonAzimuthDeltaDeg = normalizeAngleDelta(viewerSnapshot.moonHorizon.azimuth - groundBearingDeg);
    const sunProjectedDistanceKm = computeProjectedGroundDistanceKm(distanceKm, sunAzimuthDeltaDeg);
    const moonProjectedDistanceKm = computeProjectedGroundDistanceKm(distanceKm, moonAzimuthDeltaDeg);
    const sunElevationAslM = computeCelestialElevationAboveSeaLevel(observerElevationM, sunProjectedDistanceKm, viewerSnapshot.sunHorizon.altitude);
    const moonElevationAslM = computeCelestialElevationAboveSeaLevel(observerElevationM, moonProjectedDistanceKm, viewerSnapshot.moonHorizon.altitude);
    const sunDeltaFromObserverM = sunElevationAslM - observerElevationM;
    const moonDeltaFromObserverM = moonElevationAslM - observerElevationM;
    const sunDeltaFromObjectM = sunElevationAslM - totalObjectElevationM;
    const moonDeltaFromObjectM = moonElevationAslM - totalObjectElevationM;

    elements.objectMetrics.innerHTML = [
      ["0. Editable object height above ground", formatMeters(objectHeightM)],
      ["1. Linear distance between observer and object", `${linearDistanceKm.toFixed(2)} km`],
      ["2. Elevation of observer above sea level", `${Math.round(observerElevationM)} m ASL`],
      ["3. Elevation of object above sea level excluding object height", `${Math.round(objectGroundElevationM)} m ASL`],
      ["4. Elevation of the Sun above sea level", `${Math.round(sunElevationAslM)} m ASL`],
      ["5. Elevation of the Moon above sea level", `${Math.round(moonElevationAslM)} m ASL`],
      ["6. Delta elevation of the object relative to the observer excluding object height", `${Math.round(objectDeltaExcludingHeightM)} m`],
      ["7. Delta elevation of the object relative to the observer including object height", `${Math.round(objectDeltaIncludingHeightM)} m`],
      ["8. Delta elevation of the Sun relative to the observer", `${Math.round(sunDeltaFromObserverM)} m`],
      ["9. Delta elevation of the Moon relative to the observer", `${Math.round(moonDeltaFromObserverM)} m`],
      ["10. Delta elevation of the Sun relative to the object including object height", `${Math.round(sunDeltaFromObjectM)} m`],
      ["11. Delta elevation of the Moon relative to the object including object height", `${Math.round(moonDeltaFromObjectM)} m`],
    ].map(([label, value]) => `<div><span class="sky-label">${label}</span><strong>${value}</strong></div>`).join("");

    elements.objectProfileSvg.innerHTML = buildObjectProfileSvg({
      currentTime,
      distanceKm,
      linearDistanceKm,
      bearingDeg: groundBearingDeg,
      slopeDeg,
      observerElevationM,
      objectGroundElevationM,
      objectHeightM,
      totalObjectElevationM,
      objectDeltaIncludingHeightM,
      sunAzimuthDeltaDeg,
      moonAzimuthDeltaDeg,
      sunProjectedDistanceKm,
      moonProjectedDistanceKm,
      sunElevationAslM,
      moonElevationAslM,
      sunDeltaFromObserverM,
      moonDeltaFromObserverM,
      sunDeltaFromObjectM,
      moonDeltaFromObjectM,
    });
    elements.objectProfileLegend.innerHTML = buildObjectProfileLegend({
      observerElevationM,
      objectGroundElevationM,
      objectHeightM,
      totalObjectElevationM,
      sunAzimuthDeltaDeg,
      moonAzimuthDeltaDeg,
      sunProjectedDistanceKm,
      moonProjectedDistanceKm,
      sunElevationAslM,
      moonElevationAslM,
      sunDeltaFromObserverM,
      moonDeltaFromObserverM,
      sunDeltaFromObjectM,
      moonDeltaFromObjectM,
    });
    elements.objectStatusLine.textContent = `Object reference at ${state.objectLocation.latitude.toFixed(3)}, ${state.objectLocation.longitude.toFixed(3)}. Ground elevation is ${Math.round(objectGroundElevationM)} m ASL and total elevation including object height is ${Math.round(totalObjectElevationM)} m ASL.`;
  }

  function renderPhase(snapshot) {
    if (state.analysis.type === "general") {
      elements.phaseSvg.innerHTML = "";
      return;
    }

    if (state.analysis.type === "solar") {
      renderSolarPhase(snapshot);
    } else {
      renderLunarPhase(snapshot);
    }
  }

  function renderSkyInfographic(snapshot, currentTime) {
    const width = 420;
    const height = 220;
    const horizonY = 168;
    const skyTop = 28;
    const left = 34;
    const right = width - 34;
    const sunX = azimuthToSkyX(snapshot.sunHorizon.azimuth, left, right);
    const moonX = azimuthToSkyX(snapshot.moonHorizon.azimuth, left, right);
    const sunY = altitudeToSkyY(snapshot.sunHorizon.altitude, horizonY, skyTop);
    const moonY = altitudeToSkyY(snapshot.moonHorizon.altitude, horizonY, skyTop);
    const sunVisible = snapshot.sunHorizon.altitude >= 0;
    const moonVisible = snapshot.moonHorizon.altitude >= 0;

    elements.snapshotSkySvg.innerHTML = `
      <defs>
        <linearGradient id="skyGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#1f3659" />
          <stop offset="68%" stop-color="#304f73" />
          <stop offset="100%" stop-color="#efe0c5" />
        </linearGradient>
        <radialGradient id="sunMarker" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#fff8c8" />
          <stop offset="70%" stop-color="#ffd36a" />
          <stop offset="100%" stop-color="#eaa326" />
        </radialGradient>
        <radialGradient id="moonMarker" cx="38%" cy="32%" r="68%">
          <stop offset="0%" stop-color="#f8f1dd" />
          <stop offset="70%" stop-color="#d9d0bb" />
          <stop offset="100%" stop-color="#97a4bd" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="420" height="220" rx="24" fill="url(#skyGradient)" />
      <path d="M ${left} ${horizonY} Q ${width / 2} ${horizonY - 14} ${right} ${horizonY}" fill="none" stroke="rgba(255,255,255,0.82)" stroke-width="2" />
      <path d="M ${left - 10} ${horizonY + 22} Q ${width / 2} ${horizonY - 10} ${right + 10} ${horizonY + 22} L ${right + 10} ${height} L ${left - 10} ${height} Z" fill="rgba(75, 56, 34, 0.3)" />
      <line x1="${left}" y1="${altitudeToSkyY(30, horizonY, skyTop)}" x2="${right}" y2="${altitudeToSkyY(30, horizonY, skyTop)}" stroke="rgba(255,255,255,0.16)" stroke-dasharray="5 8" />
      <line x1="${left}" y1="${altitudeToSkyY(60, horizonY, skyTop)}" x2="${right}" y2="${altitudeToSkyY(60, horizonY, skyTop)}" stroke="rgba(255,255,255,0.12)" stroke-dasharray="5 8" />
      <text x="${left}" y="${horizonY + 18}" fill="rgba(255,255,255,0.76)" font-size="12" font-family="Space Grotesk, sans-serif">Horizon 0°</text>
      <text x="${left}" y="${altitudeToSkyY(30, horizonY, skyTop) - 8}" fill="rgba(255,255,255,0.5)" font-size="11" font-family="Space Grotesk, sans-serif">30°</text>
      <text x="${left}" y="${altitudeToSkyY(60, horizonY, skyTop) - 8}" fill="rgba(255,255,255,0.5)" font-size="11" font-family="Space Grotesk, sans-serif">60°</text>
      <line x1="${sunX}" y1="${horizonY}" x2="${sunX}" y2="${sunY}" stroke="rgba(255, 211, 106, 0.35)" stroke-width="2" />
      <line x1="${moonX}" y1="${horizonY}" x2="${moonX}" y2="${moonY}" stroke="rgba(151, 164, 189, 0.38)" stroke-width="2" stroke-dasharray="6 6" />
      <circle cx="${sunX}" cy="${sunY}" r="14" fill="url(#sunMarker)" opacity="${sunVisible ? "1" : "0.42"}">
        <title>Sun altitude ${formatAngle(snapshot.sunHorizon.altitude)} at azimuth ${formatAngle(snapshot.sunHorizon.azimuth)}</title>
      </circle>
      <circle cx="${moonX}" cy="${moonY}" r="12" fill="url(#moonMarker)" opacity="${moonVisible ? "0.96" : "0.38"}">
        <title>Moon altitude ${formatAngle(snapshot.moonHorizon.altitude)} at azimuth ${formatAngle(snapshot.moonHorizon.azimuth)}</title>
      </circle>
      <text x="${clamp(sunX - 18, 20, width - 70)}" y="${Math.max(sunY - 18, 18)}" fill="#fff6d4" font-size="12" font-family="Space Grotesk, sans-serif">Sun</text>
      <text x="${clamp(moonX - 22, 20, width - 76)}" y="${Math.max(moonY - 18, 18)}" fill="#ecf2ff" font-size="12" font-family="Space Grotesk, sans-serif">Moon</text>
      <text x="${width - 162}" y="28" fill="rgba(255,255,255,0.72)" font-size="12" font-family="Space Grotesk, sans-serif">${formatTimeWithZone(currentTime, state.timeZone)}</text>
    `;

    elements.snapshotSkyCaption.textContent = `At the current pin, the Sun is ${sunVisible ? "above" : "below"} the horizon at ${formatAngle(snapshot.sunHorizon.altitude)} and the Moon is ${moonVisible ? "above" : "below"} at ${formatAngle(snapshot.moonHorizon.altitude)}.`;
  }

  function renderGeneralPhase(snapshot) {
    const sunRadius = 58;
    const moonRadius = 38;
    const maxOffset = 88;
    const horizontalOffset = maxOffset * Math.sin(degToRad(normalizeAngleDelta(snapshot.moonHorizon.azimuth - snapshot.sunHorizon.azimuth)));
    const verticalOffset = clamp((snapshot.sunHorizon.altitude - snapshot.moonHorizon.altitude) * 2.1, -92, 92);

    elements.phaseSvg.innerHTML = `
      <defs>
        <radialGradient id="generalSunGlow" cx="50%" cy="50%" r="58%">
          <stop offset="0%" stop-color="#fff4b8" />
          <stop offset="72%" stop-color="#ffd365" />
          <stop offset="100%" stop-color="#f0aa20" />
        </radialGradient>
        <radialGradient id="generalMoonGlow" cx="40%" cy="38%" r="65%">
          <stop offset="0%" stop-color="#fff0c7" />
          <stop offset="70%" stop-color="#e7d7af" />
          <stop offset="100%" stop-color="#bba989" />
        </radialGradient>
      </defs>
      <rect width="320" height="320" fill="transparent" />
      <circle cx="160" cy="160" r="118" fill="rgba(255, 255, 255, 0.04)" />
      <circle cx="120" cy="140" r="${sunRadius}" fill="url(#generalSunGlow)" />
      <circle cx="${220 + horizontalOffset * 0.25}" cy="${182 + verticalOffset * 0.35}" r="${moonRadius}" fill="url(#generalMoonGlow)" />
      <text x="24" y="30" fill="rgba(255,255,255,0.78)" font-size="12" font-family="Space Grotesk, sans-serif">Sun alt ${formatAngle(snapshot.sunHorizon.altitude)} · Moon alt ${formatAngle(snapshot.moonHorizon.altitude)}</text>
      <text x="24" y="50" fill="rgba(255,255,255,0.6)" font-size="12" font-family="Space Grotesk, sans-serif">Azimuth gap ${formatAngle(Math.abs(normalizeAngleDelta(snapshot.moonHorizon.azimuth - snapshot.sunHorizon.azimuth)))}</text>
    `;
  }

  function renderSolarPhase(snapshot) {
    const sunRadius = 88;
    const moonRadius = sunRadius * (snapshot.moonRadiusDeg / snapshot.sunRadiusDeg);
    const scale = 88 / Math.max(snapshot.sunRadiusDeg, snapshot.moonRadiusDeg, 0.01);
    const dx = snapshot.relativeDxDeg * scale;
    const dy = -snapshot.relativeDyDeg * scale;

    elements.phaseSvg.innerHTML = `
      <defs>
        <radialGradient id="sunGlow" cx="50%" cy="50%" r="58%">
          <stop offset="0%" stop-color="#fff4b8" />
          <stop offset="72%" stop-color="#ffd365" />
          <stop offset="100%" stop-color="#f0aa20" />
        </radialGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="320" height="320" fill="transparent" />
      <circle cx="160" cy="160" r="118" fill="rgba(255, 211, 106, 0.08)" />
      <circle cx="160" cy="160" r="${sunRadius}" fill="url(#sunGlow)" filter="url(#glow)" />
      <circle cx="${160 + dx}" cy="${160 + dy}" r="${moonRadius}" fill="#0e1421" opacity="0.98" />
      <circle cx="160" cy="160" r="${sunRadius}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1" />
      <text x="24" y="30" fill="rgba(255,255,255,0.78)" font-size="12" font-family="Space Grotesk, sans-serif">Coverage ${formatPercent(snapshot.coverage)}</text>
      <text x="24" y="50" fill="rgba(255,255,255,0.6)" font-size="12" font-family="Space Grotesk, sans-serif">Sun alt ${formatAngle(snapshot.sunHorizon.altitude)} · Moon alt ${formatAngle(snapshot.moonHorizon.altitude)}</text>
    `;
  }

  function renderLunarPhase(snapshot) {
    const moonRadius = 82;
    const shadowRadius = moonRadius * snapshot.shadowRadiusRatio;
    const dx = snapshot.shadowOffsetNormalized * moonRadius;

    elements.phaseSvg.innerHTML = `
      <defs>
        <radialGradient id="moonGlow" cx="40%" cy="38%" r="65%">
          <stop offset="0%" stop-color="#fff0c7" />
          <stop offset="70%" stop-color="#e7d7af" />
          <stop offset="100%" stop-color="#bba989" />
        </radialGradient>
        <mask id="moonMask">
          <rect width="320" height="320" fill="white" />
          <circle cx="${160 + dx}" cy="160" r="${shadowRadius}" fill="black" opacity="${Math.min(0.96, 0.22 + snapshot.coverage * 0.9)}" />
        </mask>
      </defs>
      <rect width="320" height="320" fill="transparent" />
      <circle cx="160" cy="160" r="114" fill="rgba(108, 153, 235, 0.07)" />
      <circle cx="160" cy="160" r="${moonRadius}" fill="url(#moonGlow)" />
      <circle cx="160" cy="160" r="${moonRadius}" fill="#e9d8b5" mask="url(#moonMask)" />
      <circle cx="${160 + dx}" cy="160" r="${shadowRadius}" fill="rgba(35,50,78,0.72)" />
      <circle cx="160" cy="160" r="${moonRadius}" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1" />
      <text x="24" y="30" fill="rgba(255,255,255,0.78)" font-size="12" font-family="Space Grotesk, sans-serif">Shadow coverage ${formatPercent(snapshot.coverage)}</text>
      <text x="24" y="50" fill="rgba(255,255,255,0.6)" font-size="12" font-family="Space Grotesk, sans-serif">Moon alt ${formatAngle(snapshot.moonHorizon.altitude)} · Sun alt ${formatAngle(snapshot.sunHorizon.altitude)}</text>
    `;
  }

  function renderMap(snapshot, objectSnapshot, currentTime) {
    if (!state.map) {
      return;
    }

    const origin = [state.observer.latitude, state.observer.longitude];
    const sunEnd = projectDestination(state.observer.latitude, state.observer.longitude, snapshot.sunHorizon.azimuth, 240);
    const moonEnd = projectDestination(state.observer.latitude, state.observer.longitude, snapshot.moonHorizon.azimuth, 200);

    updateDirectionLine(
      "sun",
      [origin, [sunEnd.latitude, sunEnd.longitude]],
      {
        color: "#f0aa20",
        weight: 4,
        opacity: 0.9,
      },
      state.layerToggles.sunLine
    );

    updateDirectionLine(
      "moon",
      [origin, [moonEnd.latitude, moonEnd.longitude]],
      {
        color: "#5f82c0",
        weight: 4,
        opacity: 0.88,
        dashArray: "8 10",
      },
      state.layerToggles.moonLine
    );

    state.marker.bindPopup(`
      <strong>Observer</strong><br>
      ${state.observer.latitude.toFixed(3)}, ${state.observer.longitude.toFixed(3)}<br>
      ${Math.round(state.observer.height)} m ASL<br>
      ${formatTimeWithZone(currentTime, state.timeZone)}
    `);

    syncObjectMarker();

    if (state.objectMarker && state.objectLocation && objectSnapshot) {
      state.objectMarker.bindPopup(`
        <strong>Object reference</strong><br>
        ${state.objectLocation.latitude.toFixed(3)}, ${state.objectLocation.longitude.toFixed(3)}<br>
        Ground ${Math.round(state.objectLocation.height || 0)} m + object ${formatMeters(state.objectLocation.objectHeight || 0)}<br>
        Sun ${formatAngle(objectSnapshot.sunHorizon.altitude)} · Moon ${formatAngle(objectSnapshot.moonHorizon.altitude)}
      `);
    }

    if (state.directionLines.sun) {
      state.directionLines.sun.bindPopup(`Sun<br>Azimuth ${formatAngle(snapshot.sunHorizon.azimuth)}<br>Altitude ${formatAngle(snapshot.sunHorizon.altitude)}`);
    }
    if (state.directionLines.moon) {
      state.directionLines.moon.bindPopup(`Moon<br>Azimuth ${formatAngle(snapshot.moonHorizon.azimuth)}<br>Altitude ${formatAngle(snapshot.moonHorizon.altitude)}`);
    }

    renderFovOverlay(snapshot);

    try {
      render3dMap(snapshot, objectSnapshot, currentTime, sunEnd, moonEnd);
    } catch (error) {
      disable3dMap("The 3D panel hit a runtime error and was disabled so the rest of the planner can keep working.", error);
    }
  }

  function render3dMap(snapshot, objectSnapshot, currentTime, sunEnd, moonEnd) {
    const viewer = state.scene3d.viewer;
    if (!viewer || viewer.isDestroyed()) {
      return;
    }

    const currentJulian = CesiumLib.JulianDate.fromDate(currentTime);
    viewer.clock.currentTime = currentJulian;
    const observerSurfaceHeightM = getCesiumSurfaceHeight(state.observer.latitude, state.observer.longitude, Number(state.observer.height) || 0);

    const observerPosition = CesiumLib.Cartesian3.fromDegrees(
      state.observer.longitude,
      state.observer.latitude,
      0
    );
    const observerCameraPosition = CesiumLib.Cartesian3.fromDegrees(
      state.observer.longitude,
      state.observer.latitude,
      Math.max(1800, observerSurfaceHeightM + 1400)
    );

    state.scene3d.observerEntity = upsertCesiumEntity(
      state.scene3d.observerEntity,
      "observer-3d",
      {
        position: observerPosition,
        billboard: {
          image: SCENE3D_MARKER_IMAGES.observer,
          width: 26,
          height: 26,
          verticalOrigin: CesiumLib.VerticalOrigin.BOTTOM,
          heightReference: CesiumLib.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: "Observer",
          font: "600 14px Space Grotesk, sans-serif",
          fillColor: CesiumLib.Color.WHITE,
          pixelOffset: new CesiumLib.Cartesian2(0, -34),
          heightReference: CesiumLib.HeightReference.CLAMP_TO_GROUND,
          verticalOrigin: CesiumLib.VerticalOrigin.TOP,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: true,
          backgroundColor: CesiumLib.Color.fromCssColorString("rgba(15,22,37,0.72)"),
        },
        description: `Observer<br>${state.observer.latitude.toFixed(3)}, ${state.observer.longitude.toFixed(3)}<br>${Math.round(state.observer.height)} m ASL`,
      }
    );

    if (state.objectLocation && objectSnapshot) {
      const objectSurfaceHeightM = getCesiumSurfaceHeight(
        state.objectLocation.latitude,
        state.objectLocation.longitude,
        Number(state.objectLocation.height) || 0
      );
      const objectPosition = CesiumLib.Cartesian3.fromDegrees(
        state.objectLocation.longitude,
        state.objectLocation.latitude,
        Number(state.objectLocation.objectHeight) || 0
      );
      state.scene3d.objectEntity = upsertCesiumEntity(
        state.scene3d.objectEntity,
        "object-3d",
        {
          position: objectPosition,
          billboard: {
            image: SCENE3D_MARKER_IMAGES.object,
            width: 24,
            height: 24,
            verticalOrigin: CesiumLib.VerticalOrigin.BOTTOM,
            heightReference: CesiumLib.HeightReference.RELATIVE_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: "Object",
            font: "600 14px Space Grotesk, sans-serif",
            fillColor: CesiumLib.Color.WHITE,
            pixelOffset: new CesiumLib.Cartesian2(0, -32),
            heightReference: CesiumLib.HeightReference.RELATIVE_TO_GROUND,
            verticalOrigin: CesiumLib.VerticalOrigin.TOP,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            showBackground: true,
            backgroundColor: CesiumLib.Color.fromCssColorString("rgba(15,22,37,0.72)"),
          },
          description: `Object<br>${state.objectLocation.latitude.toFixed(3)}, ${state.objectLocation.longitude.toFixed(3)}<br>Sun alt ${formatAngle(objectSnapshot.sunHorizon.altitude)} · Moon alt ${formatAngle(objectSnapshot.moonHorizon.altitude)}`,
        }
      );
    } else if (state.scene3d.objectEntity) {
      viewer.entities.remove(state.scene3d.objectEntity);
      state.scene3d.objectEntity = null;
    }

    state.scene3d.sunLineEntity = updateCesiumLineEntity(
      state.scene3d.sunLineEntity,
      "sun-line-3d",
      createCelestialLinePositions(snapshot.sunHorizon, sunEnd, 240, observerSurfaceHeightM),
      {
        width: 4,
        material: CesiumLib.Color.fromCssColorString("#f0aa20"),
      },
      state.layerToggles.sunLine
    );

    state.scene3d.moonLineEntity = updateCesiumLineEntity(
      state.scene3d.moonLineEntity,
      "moon-line-3d",
      createCelestialLinePositions(snapshot.moonHorizon, moonEnd, 200, observerSurfaceHeightM),
      {
        width: 3,
        material: new CesiumLib.PolylineDashMaterialProperty({
          color: CesiumLib.Color.fromCssColorString("#5f82c0"),
          dashLength: 14,
        }),
      },
      state.layerToggles.moonLine
    );

    state.scene3d.fovEntity = updateCesiumFovEntity(snapshot);
    frameCesiumCamera(observerCameraPosition);
    viewer.scene.requestRender();
  }

  function upsertCesiumEntity(entity, id, properties) {
    const viewer = state.scene3d.viewer;
    if (!viewer) {
      return null;
    }

    if (!entity) {
      return viewer.entities.add({
        id,
        ...properties,
      });
    }

    Object.assign(entity, properties);
    return entity;
  }

  function updateCesiumLineEntity(entity, id, positions, polylineProps, enabled) {
    const viewer = state.scene3d.viewer;
    if (!viewer) {
      return null;
    }

    if (!enabled) {
      if (entity) {
        viewer.entities.remove(entity);
      }
      return null;
    }

    if (!entity) {
      return viewer.entities.add({
        id,
        polyline: {
          positions,
          clampToGround: false,
          arcType: CesiumLib.ArcType.NONE,
          ...polylineProps,
        },
      });
    }

    entity.polyline = {
      positions,
      clampToGround: false,
      arcType: CesiumLib.ArcType.NONE,
      ...polylineProps,
    };
    return entity;
  }

  function createCelestialLinePositions(horizon, destination, horizontalDistanceKm, observerElevationM) {
    const endElevationM = computeCelestialElevationAboveSeaLevel(observerElevationM, horizontalDistanceKm, horizon.altitude);
    return [
      CesiumLib.Cartesian3.fromDegrees(
        state.observer.longitude,
        state.observer.latitude,
        observerElevationM
      ),
      CesiumLib.Cartesian3.fromDegrees(
        destination.longitude,
        destination.latitude,
        endElevationM
      ),
    ];
  }

  function getCesiumSurfaceHeight(latitude, longitude, fallbackHeightM) {
    const viewer = state.scene3d.viewer;
    if (!viewer || viewer.isDestroyed() || !CesiumLib) {
      return fallbackHeightM;
    }

    const cartographic = CesiumLib.Cartographic.fromDegrees(longitude, latitude);
    const sampledHeight = viewer.scene.globe.getHeight(cartographic);
    return Number.isFinite(sampledHeight) ? sampledHeight : fallbackHeightM;
  }

  function createScene3dMarkerSvg(kind) {
    const isObserver = kind === "observer";
    const bodyFill = isObserver ? "%23d2612a" : "%235779ba";
    const glowFill = isObserver ? "%23f3b17c" : "%2383a9df";
    const head = isObserver
      ? '<circle cx="16" cy="12" r="7" fill="' + bodyFill + '" stroke="white" stroke-width="2" />'
      : '<rect x="10.5" y="6.5" width="11" height="11" rx="2.5" transform="rotate(45 16 12)" fill="' + bodyFill + '" stroke="white" stroke-width="2" />';
    const stem = `<path d="M16 28 L10.5 18.5 Q16 20.5 21.5 18.5 Z" fill="${bodyFill}" stroke="white" stroke-width="1.6" stroke-linejoin="round" />`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="12" r="13" fill="${glowFill}" fill-opacity="0.18" />${stem}${head}</svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function updateCesiumFovEntity(snapshot) {
    const viewer = state.scene3d.viewer;
    if (!viewer) {
      return null;
    }

    if (!state.layerToggles.fov) {
      if (state.scene3d.fovEntity) {
        viewer.entities.remove(state.scene3d.fovEntity);
      }
      return null;
    }

    const targetBearingDeg = getFovBearingDeg(snapshot);
    if (targetBearingDeg === null) {
      if (state.scene3d.fovEntity) {
        viewer.entities.remove(state.scene3d.fovEntity);
      }
      return null;
    }

    const fov = computeFieldOfView(
      state.camera.sensorWidthMm,
      state.camera.sensorHeightMm,
      state.camera.focalLengthMm
    );
    const polygon = createSectorPolygon(
      state.observer.latitude,
      state.observer.longitude,
      targetBearingDeg,
      fov.horizontalDeg,
      FOV_RANGE_KM,
      28
    );
    const closedPolygon = [[state.observer.latitude, state.observer.longitude], ...polygon, [state.observer.latitude, state.observer.longitude]];
    const degrees = [];
    closedPolygon.forEach((point) => {
      degrees.push(point[1], point[0]);
    });
    const color = "#5779ba";

    const polyline = {
      positions: CesiumLib.Cartesian3.fromDegreesArray(degrees),
      width: 2,
      material: CesiumLib.Color.fromCssColorString(color),
      clampToGround: true,
      arcType: CesiumLib.ArcType.GEODESIC,
    };

    if (!state.scene3d.fovEntity) {
      return viewer.entities.add({
        id: "fov-3d",
        polyline,
      });
    }

    state.scene3d.fovEntity.polyline = polyline;
    return state.scene3d.fovEntity;
  }

  function frameCesiumCamera(observerPosition) {
    const observerKey = `${state.observer.latitude.toFixed(4)}:${state.observer.longitude.toFixed(4)}:${Math.round(state.observer.height || 0)}`;
    if (state.scene3d.lastObserverKey === observerKey) {
      return;
    }

    state.scene3d.lastObserverKey = observerKey;
    state.scene3d.viewer.camera.flyTo({
      destination: observerPosition,
      orientation: {
        heading: CesiumLib.Math.toRadians(0),
        pitch: CesiumLib.Math.toRadians(-55),
        roll: 0,
      },
      duration: 0.9,
    });
  }

  function recenter3dMap(force = false) {
    if (!state.scene3d.viewer || state.scene3d.viewer.isDestroyed()) {
      return;
    }

    if (force) {
      state.scene3d.lastObserverKey = "";
    }

    const observerCameraPosition = CesiumLib.Cartesian3.fromDegrees(
      state.observer.longitude,
      state.observer.latitude,
      Math.max(1800, Math.max(0, Number(state.observer.height) || 0) + 1400)
    );
    frameCesiumCamera(observerCameraPosition);
  }

  function disable3dMap(message, error) {
    if (error) {
      console.error(message, error);
    }

    if (state.scene3d.viewer && !state.scene3d.viewer.isDestroyed()) {
      state.scene3d.viewer.destroy();
    }

    state.scene3d.viewer = null;
    state.scene3d.observerEntity = null;
    state.scene3d.objectEntity = null;
    state.scene3d.sunLineEntity = null;
    state.scene3d.moonLineEntity = null;
    state.scene3d.fovEntity = null;
    state.scene3d.buildingsTileset = null;
    state.scene3d.supportsTerrain = false;
    state.scene3d.supportsBuildings = false;
    state.scene3d.initialized = false;
    state.scene3d.lastObserverKey = "";

    if (elements.cesiumStatusLine) {
      elements.cesiumStatusLine.textContent = message;
    }
  }

  function updateDirectionLine(key, latLngs, style, enabled) {
    if (!enabled) {
      removeMapLayer(state.directionLines[key]);
      state.directionLines[key] = null;
      return;
    }

    if (!state.directionLines[key]) {
      state.directionLines[key] = L.polyline(latLngs, style).addTo(state.map);
      return;
    }

    state.directionLines[key].setStyle(style);
    state.directionLines[key].setLatLngs(latLngs);
  }

  function removeMapLayer(layer) {
    if (layer && state.map && state.map.hasLayer(layer)) {
      state.map.removeLayer(layer);
    }
  }

  function renderFovOverlay(snapshot) {
    if (!state.map) {
      return;
    }

    if (!state.layerToggles.fov) {
      removeMapLayer(state.fovLayer);
      state.fovLayer = null;
      return;
    }

    const targetBearingDeg = getFovBearingDeg(snapshot);
    if (targetBearingDeg === null) {
      removeMapLayer(state.fovLayer);
      state.fovLayer = null;
      return;
    }

    const fov = computeFieldOfView(
      state.camera.sensorWidthMm,
      state.camera.sensorHeightMm,
      state.camera.focalLengthMm
    );
    const polygon = createSectorPolygon(
      state.observer.latitude,
      state.observer.longitude,
      targetBearingDeg,
      fov.horizontalDeg,
      FOV_RANGE_KM,
      28
    );
    const color = "#5779ba";

    if (!state.fovLayer) {
      state.fovLayer = L.polygon(polygon, {
        color,
        weight: 2,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: 0.12,
      }).addTo(state.map);
    } else {
      state.fovLayer.setStyle({
        color,
        fillColor: color,
      });
      state.fovLayer.setLatLngs(polygon);
    }

    state.fovLayer.bindPopup(
      `<strong>Camera FoV</strong><br>${state.camera.brand} ${state.camera.model}<br>${state.camera.focalLengthMm.toFixed(0)} mm · Object alignment<br>Horizontal ${formatAngle(fov.horizontalDeg)} · Vertical ${formatAngle(fov.verticalDeg)}`
    );
  }

  function getFovBearingDeg(snapshot) {
    if (!state.objectLocation) {
      return null;
    }

    return computeBearingDeg(state.observer, state.objectLocation);
  }

  function makeSolarSnapshot(date, observer) {
    const sunEquator = AstronomyLib.Equator(AstronomyLib.Body.Sun, date, observer, true, true);
    const moonEquator = AstronomyLib.Equator(AstronomyLib.Body.Moon, date, observer, true, true);
    const sunHorizon = AstronomyLib.Horizon(date, observer, sunEquator.ra, sunEquator.dec, "normal");
    const moonHorizon = AstronomyLib.Horizon(date, observer, moonEquator.ra, moonEquator.dec, "normal");
    const separationDeg = AstronomyLib.AngleBetween(sunEquator.vec, moonEquator.vec);
    const sunRadiusDeg = radToDeg(Math.asin(Math.min(1, SUN_RADIUS_AU / sunEquator.dist)));
    const moonRadiusDeg = radToDeg(Math.asin(Math.min(1, MOON_RADIUS_AU / moonEquator.dist)));
    const overlapArea = circleOverlapArea(sunRadiusDeg, moonRadiusDeg, separationDeg);
    const sunArea = Math.PI * sunRadiusDeg * sunRadiusDeg;
    const coverage = sunArea > 0 ? clamp(overlapArea / sunArea, 0, 1) : 0;
    const magnitude = clamp((moonRadiusDeg + sunRadiusDeg - separationDeg) / (sunRadiusDeg * 2), 0, 2);
    const relativeDxDeg = normalizeAngleDelta((moonEquator.ra - sunEquator.ra) * 15) * Math.cos(degToRad((moonEquator.dec + sunEquator.dec) / 2));
    const relativeDyDeg = moonEquator.dec - sunEquator.dec;

    return {
      time: new Date(date.getTime()),
      coverage,
      magnitude,
      separationDeg,
      sunRadiusDeg,
      moonRadiusDeg,
      relativeDxDeg,
      relativeDyDeg,
      sunHorizon,
      moonHorizon,
    };
  }

  function makeLunarSnapshot(date, lunarEvent, observer, timing) {
    const sunEquator = AstronomyLib.Equator(AstronomyLib.Body.Sun, date, observer, true, true);
    const moonEquator = AstronomyLib.Equator(AstronomyLib.Body.Moon, date, observer, true, true);
    const sunHorizon = AstronomyLib.Horizon(date, observer, sunEquator.ra, sunEquator.dec, "normal");
    const moonHorizon = AstronomyLib.Horizon(date, observer, moonEquator.ra, moonEquator.dec, "normal");
    const peakObscuration = clamp(Number(lunarEvent.obscuration) || 0, 0, 1);
    const penumbralSemiMinutes = timing.penumbralSemiMinutes;
    const partialSemiMinutes = timing.partialSemiMinutes;
    const shadowRadiusRatio = peakObscuration >= 1 ? 1.45 : 1.32;
    const peakShadowOffset = solveOffsetForCoverage(1, shadowRadiusRatio, peakObscuration);
    const minutesFromPeak = Math.abs((date.getTime() - lunarEvent.peak.date.getTime()) / 60000);
    const controlRange = partialSemiMinutes > 0 ? partialSemiMinutes : penumbralSemiMinutes;
    const progress = clamp(1 - minutesFromPeak / Math.max(controlRange, 1), 0, 1);
    const contactOffset = 1 + shadowRadiusRatio;
    const currentOffset = contactOffset - progress * (contactOffset - peakShadowOffset);
    const coverage = circleOverlapArea(1, shadowRadiusRatio, currentOffset) / Math.PI;

    return {
      time: new Date(date.getTime()),
      coverage: clamp(coverage, 0, 1),
      magnitude: clamp(progress * Math.max(peakObscuration, 0.001), 0, 1.5),
      sunHorizon,
      moonHorizon,
      shadowRadiusRatio,
      shadowOffsetNormalized: currentOffset,
    };
  }

  function refineSolarPeak(seedDate, observer) {
    let best = makeSolarSnapshot(seedDate, observer);
    for (let minuteOffset = -12; minuteOffset <= 12; minuteOffset += 1) {
      const sample = makeSolarSnapshot(addMinutes(seedDate, minuteOffset), observer);
      if (sample.coverage > best.coverage) {
        best = sample;
      }
    }
    return best;
  }

  function makeObserver(observerInput) {
    return new AstronomyLib.Observer(observerInput.latitude, observerInput.longitude, observerInput.height || 0);
  }

  function makeLocationSnapshot(date, location) {
    const observer = makeObserver(location);
    if (state.analysis && state.analysis.type === "lunar") {
      return makeLunarSnapshot(date, state.analysis.event, observer, state.analysis);
    }
    return makeSolarSnapshot(date, observer);
  }

  function getBrowserTimeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  }

  function getTimeFormatter(options, timeZone) {
    return new Intl.DateTimeFormat("en-GB", {
      ...options,
      timeZone: timeZone || state.timeZone,
    });
  }

  function getZonedDateParts(date, timeZone) {
    const parts = getTimeFormatter({
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }, timeZone).formatToParts(date);

    return parts.reduce((accumulator, part) => {
      if (part.type !== "literal") {
        accumulator[part.type] = part.value;
      }
      return accumulator;
    }, {});
  }

  function formatDate(date, timeZone) {
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: timeZone || state.timeZone,
    }).format(date);
  }

  function formatTimeWithZone(date, timeZone) {
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: timeZone || state.timeZone,
    }).format(date);
  }

  function formatClockTime(date, timeZone) {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: timeZone || state.timeZone,
    }).format(date);
  }

  function formatDateTimeLocal(date, timeZone) {
    const parts = getZonedDateParts(date, timeZone);
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function parseDateTimeLocal(value, timeZone) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || "");
    if (!match) {
      return null;
    }

    const desired = {
      year: match[1],
      month: match[2],
      day: match[3],
      hour: match[4],
      minute: match[5],
    };

    let candidate = new Date(Date.UTC(
      Number(desired.year),
      Number(desired.month) - 1,
      Number(desired.day),
      Number(desired.hour),
      Number(desired.minute)
    ));

    for (let index = 0; index < 4; index += 1) {
      const actual = getZonedDateParts(candidate, timeZone);
      const diffMinutes = computeWallClockDifferenceMinutes(desired, actual);
      if (diffMinutes === 0) {
        return candidate;
      }
      candidate = addMinutes(candidate, diffMinutes);
    }

    return candidate;
  }

  function formatPercent(value) {
    return `${(value * 100).toFixed(1)}%`;
  }

  function formatAngle(value) {
    return `${value.toFixed(1)}°`;
  }

  function formatMeters(value) {
    return `${value.toFixed(1)} m`;
  }

  function computeCelestialElevationAboveSeaLevel(baseElevationM, horizontalDistanceKm, altitudeDeg) {
    return baseElevationM + Math.tan(degToRad(altitudeDeg)) * horizontalDistanceKm * 1000;
  }

  function computeProjectedGroundDistanceKm(horizontalDistanceKm, azimuthDeltaDeg) {
    return horizontalDistanceKm * Math.cos(degToRad(azimuthDeltaDeg));
  }

  function spreadLabelYs(values, minY, maxY, minGap) {
    const positioned = values.map((value, index) => ({ index, y: clamp(value, minY, maxY) }))
      .sort((left, right) => left.y - right.y);

    for (let index = 1; index < positioned.length; index += 1) {
      if (positioned[index].y - positioned[index - 1].y < minGap) {
        positioned[index].y = positioned[index - 1].y + minGap;
      }
    }

    for (let index = positioned.length - 1; index >= 0; index -= 1) {
      if (positioned[index].y > maxY) {
        positioned[index].y = maxY;
      }
      if (index > 0 && positioned[index].y - positioned[index - 1].y < minGap) {
        positioned[index - 1].y = positioned[index].y - minGap;
      }
    }

    return positioned
      .sort((left, right) => left.index - right.index)
      .map((item) => clamp(item.y, minY, maxY));
  }

  function formatTimeInputValue(date, timeZone) {
    const parts = getZonedDateParts(date, timeZone);
    return `${parts.hour}:${parts.minute}`;
  }

  function syncSliderToSelectedDateTime() {
    if (!state.analysis) {
      return;
    }

    const sliderMinutes = Math.round((state.selectedDateTime.getTime() - state.analysis.rangeStart.getTime()) / 60000);
    const min = Number(elements.timeSlider.min);
    const max = Number(elements.timeSlider.max);
    const nextValue = String(clamp(sliderMinutes, min, max));
    elements.timeSlider.value = nextValue;
    elements.timeSlider3d.value = nextValue;
  }

  function saveCurrentConfigToFile() {
    const payload = JSON.stringify(collectPlannerConfig(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `eclipse-scout-config-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
    elements.configStatusLine.textContent = "Saved the current configuration to a JSON file.";
  }

  async function onConfigFileSelected() {
    const file = elements.loadConfigFileInput.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const config = JSON.parse(text);
      applyPlannerConfig(config);
      if (elements.rememberLoadedConfigCheckbox.checked) {
        persistStartupDefaultConfig(file.name, config);
      }
      updateConfigStatusLine(file.name, elements.rememberLoadedConfigCheckbox.checked);
    } catch (error) {
      console.error("Could not load configuration file.", error);
      elements.configStatusLine.textContent = "Could not load that configuration file. Make sure it is valid JSON exported by this app.";
    }
  }

  function collectPlannerConfig() {
    return {
      version: 1,
      mode: state.mode,
      selectedKey: state.selectedKey,
      selectedDateTime: state.selectedDateTime.toISOString(),
      timeZone: state.timeZone,
      observer: { ...state.observer },
      objectLocation: state.objectLocation ? { ...state.objectLocation } : null,
      camera: { ...state.camera },
      layerToggles: { ...state.layerToggles },
      baseMapMode: state.baseMapMode,
    };
  }

  function applyPlannerConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("Invalid planner config payload.");
    }

    const desiredDateTime = parseLoadedDate(config.selectedDateTime) || new Date(state.selectedDateTime.getTime());
    state.mode = ["solar", "lunar", "general"].includes(config.mode) ? config.mode : state.mode;
    state.timeZone = typeof config.timeZone === "string" && config.timeZone ? config.timeZone : state.timeZone;
    state.selectedKey = typeof config.selectedKey === "string" ? config.selectedKey : state.selectedKey;
    state.observer = sanitizeObserverConfig(config.observer, state.observer);
    state.objectLocation = sanitizeObjectConfig(config.objectLocation);
    state.layerToggles = {
      sunLine: config.layerToggles?.sunLine !== false,
      moonLine: config.layerToggles?.moonLine !== false,
      fov: config.layerToggles?.fov === true,
    };
    state.baseMapMode = config.baseMapMode === "satellite" ? "satellite" : DEFAULT_LEAFLET_BASE_MAP;
    applyCameraConfig(config.camera);
    state.pendingSelectedDateTime = desiredDateTime;

    populateTimeZoneOptions();
    populateEventTypeOptions();
    populateEventOptions();
    if (state.pendingSelectedDateTime) {
      state.selectedDateTime = new Date(state.pendingSelectedDateTime.getTime());
    }
    hydrateForm();
    hydrateCameraForm();
    updateMapToggleButtons();
    updateMapTargetControl();
    setLeafletBaseMap(state.baseMapMode);
    syncMarker();
    syncObjectMarker();
    analyzeSelection();
    finalizePendingSelectedDateTime();
  }

  function sanitizeObserverConfig(observer, fallback) {
    const next = observer && typeof observer === "object" ? observer : fallback;
    return {
      latitude: clampNumber(next.latitude, -90, 90, fallback.latitude),
      longitude: clampNumber(next.longitude, -180, 180, fallback.longitude),
      height: finiteNumber(next.height, fallback.height),
    };
  }

  function sanitizeObjectConfig(objectLocation) {
    if (!objectLocation || typeof objectLocation !== "object") {
      return null;
    }

    return {
      latitude: clampNumber(objectLocation.latitude, -90, 90, state.observer.latitude),
      longitude: clampNumber(objectLocation.longitude, -180, 180, state.observer.longitude),
      height: finiteNumber(objectLocation.height, 0),
      objectHeight: Math.max(0, finiteNumber(objectLocation.objectHeight, 0)),
      label: typeof objectLocation.label === "string" && objectLocation.label ? objectLocation.label : "Object reference",
    };
  }

  function applyCameraConfig(cameraConfig) {
    const nextCamera = cameraConfig && typeof cameraConfig === "object" ? cameraConfig : {};
    state.camera.mode = nextCamera.mode === "manual" ? "manual" : "preset";
    state.camera.targetBody = nextCamera.targetBody === "moon" ? "moon" : "sun";
    state.camera.focalLengthMm = Math.max(1, finiteNumber(nextCamera.focalLengthMm, state.camera.focalLengthMm));

    const requestedPreset = CAMERA_PRESETS.find((preset) => preset.brand === nextCamera.brand && preset.model === nextCamera.model) || DEFAULT_CAMERA_PRESET;
    applyCameraPreset(requestedPreset);

    if (state.camera.mode === "manual") {
      state.camera.sensorWidthMm = Math.max(1, finiteNumber(nextCamera.sensorWidthMm, DEFAULT_CAMERA_PRESET.sensorWidthMm));
      state.camera.sensorHeightMm = Math.max(1, finiteNumber(nextCamera.sensorHeightMm, DEFAULT_CAMERA_PRESET.sensorHeightMm));
      state.camera.sensorFormat = classifySensorFormat(state.camera.sensorWidthMm);
      state.camera.cropFactor = computeCropFactor(state.camera.sensorWidthMm);
    }
  }

  function applyStartupDefaultConfig() {
    const stored = readStartupDefaultConfig();
    if (!stored) {
      return;
    }

    try {
      applyPlannerConfig(stored.config);
      elements.rememberLoadedConfigCheckbox.checked = true;
      elements.configStatusLine.textContent = `Loaded startup default from ${stored.name}.`;
    } catch (error) {
      console.error("Could not apply the startup default config.", error);
      clearStartupDefaultConfig(false);
      elements.configStatusLine.textContent = "The saved startup default could not be applied and was cleared.";
    }
  }

  function readStartupDefaultConfig() {
    try {
      const raw = window.localStorage.getItem(STARTUP_CONFIG_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("Could not read the startup default config.", error);
      return null;
    }
  }

  function persistStartupDefaultConfig(name, config) {
    window.localStorage.setItem(STARTUP_CONFIG_STORAGE_KEY, JSON.stringify({
      name: name || "saved-config.json",
      config,
    }));
  }

  function clearStartupDefaultConfig(updateStatus = true) {
    try {
      window.localStorage.removeItem(STARTUP_CONFIG_STORAGE_KEY);
    } catch (error) {
      console.warn("Could not clear the startup default config.", error);
    }
    if (elements.rememberLoadedConfigCheckbox) {
      elements.rememberLoadedConfigCheckbox.checked = false;
    }
    if (updateStatus) {
      updateConfigStatusLine();
    }
  }

  function updateConfigStatusLine(fileName = "", remembered = false) {
    const stored = readStartupDefaultConfig();
    if (remembered && fileName) {
      elements.configStatusLine.textContent = `Loaded ${fileName} and saved it as the startup default for this browser.`;
      return;
    }
    if (fileName) {
      elements.configStatusLine.textContent = `Loaded ${fileName}.`;
      return;
    }
    elements.configStatusLine.textContent = stored
      ? `Startup default: ${stored.name}.`
      : "No startup default is configured.";
  }

  function finalizePendingSelectedDateTime() {
    if (!state.pendingSelectedDateTime) {
      return;
    }

    state.selectedDateTime = new Date(state.pendingSelectedDateTime.getTime());
    syncSliderToSelectedDateTime();
    renderSnapshot();
    state.pendingSelectedDateTime = null;
  }

  function parseLoadedDate(value) {
    const nextDate = new Date(value);
    return Number.isNaN(nextDate.getTime()) ? null : nextDate;
  }

  function finiteNumber(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function clampNumber(value, min, max, fallback) {
    return clamp(finiteNumber(value, fallback), min, max);
  }

  async function fetchElevationMeters(latitude, longitude) {
    const response = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`);
    if (!response.ok) {
      throw new Error(`Elevation lookup failed with ${response.status}`);
    }

    const payload = await response.json();
    const elevation = Array.isArray(payload.elevation) ? payload.elevation[0] : payload.elevation;
    return Number.isFinite(elevation) ? Number(elevation) : null;
  }

  async function refreshLocationElevation(target) {
    const location = target === "object" ? state.objectLocation : state.observer;
    if (!location) {
      return;
    }

    const requestId = (state.elevationRequestIds[target] || 0) + 1;
    state.elevationRequestIds[target] = requestId;
    const latitude = location.latitude;
    const longitude = location.longitude;

    if (target === "object") {
      elements.objectStatusLine.textContent = "Fetching object ground elevation for the selected pin...";
    } else {
      elements.statusLine.textContent = "Fetching observer elevation for the selected pin...";
    }

    try {
      const elevationM = await fetchElevationMeters(latitude, longitude);
      if (state.elevationRequestIds[target] !== requestId || elevationM === null) {
        return;
      }

      if (target === "object") {
        if (!state.objectLocation || state.objectLocation.latitude !== latitude || state.objectLocation.longitude !== longitude) {
          return;
        }
        state.objectLocation.height = elevationM;
        hydrateForm();
        refreshForSupplementaryLocation();
        elements.objectStatusLine.textContent = `Object ground elevation updated to ${Math.round(elevationM)} m ASL for the current pin.`;
        return;
      }

      if (state.observer.latitude !== latitude || state.observer.longitude !== longitude) {
        return;
      }
      state.observer.height = elevationM;
      hydrateForm();
      analyzeSelection();
      elements.statusLine.textContent = `Observer elevation updated to ${Math.round(elevationM)} m ASL for the current pin.`;
    } catch (error) {
      if (state.elevationRequestIds[target] !== requestId) {
        return;
      }
      if (target === "object") {
        elements.objectStatusLine.textContent = "Object elevation lookup failed. You can still enter the ground elevation manually.";
      } else {
        elements.statusLine.textContent = "Observer elevation lookup failed. You can still enter the elevation manually.";
      }
    }
  }

  function formatDurationMinutes(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    if (hours <= 0) {
      return `${minutes} min`;
    }
    return `${hours} h ${minutes} min`;
  }

  function formatLatLonPair(latitude, longitude) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return "No central path point";
    }
    return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }

  function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
  }

  function getLocalDayRange(date) {
    const parts = getZonedDateParts(date, state.timeZone);
    const start = parseDateTimeLocal(`${parts.year}-${parts.month}-${parts.day}T00:00`, state.timeZone);
    const end = parseDateTimeLocal(`${parts.year}-${parts.month}-${parts.day}T23:59`, state.timeZone);
    return { start, end };
  }

  function computeWallClockDifferenceMinutes(targetParts, actualParts) {
    const targetUtc = Date.UTC(
      Number(targetParts.year),
      Number(targetParts.month) - 1,
      Number(targetParts.day),
      Number(targetParts.hour),
      Number(targetParts.minute)
    );
    const actualUtc = Date.UTC(
      Number(actualParts.year),
      Number(actualParts.month) - 1,
      Number(actualParts.day),
      Number(actualParts.hour),
      Number(actualParts.minute)
    );
    return Math.round((targetUtc - actualUtc) / 60000);
  }

  async function onSearchLocation(target, input, resultsContainer) {
    const query = input.value.trim();
    if (!query) {
      renderSearchResults(resultsContainer, [], "Enter a place name or coordinates to search.", target);
      return;
    }

    const coordinateResult = parseCoordinateQuery(query);
    if (coordinateResult) {
      applySearchResult(coordinateResult, target);
      renderSearchResults(resultsContainer, [coordinateResult], "Coordinates applied directly.", target);
      return;
    }

    renderSearchResults(resultsContainer, [], "Searching...", target);

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error(`Search failed with ${response.status}`);
      }

      const results = await response.json();
      if (!Array.isArray(results) || !results.length) {
        renderSearchResults(resultsContainer, [], "No matching place was found.", target);
        return;
      }

      renderSearchResults(resultsContainer, results.map((item) => ({
        latitude: Number(item.lat),
        longitude: Number(item.lon),
        height: null,
        heightProvided: false,
        label: item.display_name,
      })), "", target);
    } catch (error) {
      renderSearchResults(resultsContainer, [], "Place search is currently unavailable. You can still enter coordinates like 38.6916, -9.2160.", target);
    }
  }

  function renderSearchResults(container, results, message, target) {
    if (!results.length) {
      container.hidden = false;
      container.innerHTML = `<div class="search-result-empty">${message || "No results."}</div>`;
      return;
    }

    container.hidden = false;
    container.innerHTML = results.map((result, index) => `
      <button type="button" class="secondary search-result-button" data-search-index="${index}">
        ${escapeHtml(result.label || `Coordinates ${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`)}
        <small>${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}${Number.isFinite(result.height) ? ` · ${Math.round(result.height)} m` : ""}</small>
      </button>
    `).join("");

    Array.from(container.querySelectorAll("[data-search-index]")).forEach((button) => {
      button.addEventListener("click", () => {
        const result = results[Number(button.dataset.searchIndex)];
        applySearchResult(result, target);
      });
    });
  }

  function applySearchResult(result, target) {
    if (target === "object") {
      state.objectLocation = {
        latitude: result.latitude,
        longitude: result.longitude,
        height: Number.isFinite(result.height) ? result.height : (state.objectLocation?.height || 0),
        objectHeight: state.objectLocation?.objectHeight || 0,
        label: result.label || "Object reference",
      };
      hydrateForm();
      syncObjectMarker();
      refreshForSupplementaryLocation();
      if (!result.heightProvided) {
        refreshLocationElevation("object");
      }
      return;
    }

    state.observer = {
      latitude: result.latitude,
      longitude: result.longitude,
      height: Number.isFinite(result.height) ? result.height : state.observer.height,
    };
    hydrateForm();
    syncMarker();
    analyzeSelection();
    if (!result.heightProvided) {
      refreshLocationElevation("observer");
    }
  }

  function parseCoordinateQuery(query) {
    const parts = query.split(/[;,\s]+/).filter(Boolean).map(Number);
    if (parts.length < 2 || parts.some((value, index) => index < 2 && !Number.isFinite(value))) {
      return null;
    }

    const [latitude, longitude, height = 0] = parts;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return null;
    }

    return {
      latitude,
      longitude,
      height: Number.isFinite(height) ? height : 0,
      heightProvided: parts.length >= 3 && Number.isFinite(height),
      label: "Custom coordinates",
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clampDate(date, minDate, maxDate) {
    return new Date(clamp(date.getTime(), minDate.getTime(), maxDate.getTime()));
  }

  function computeFieldOfView(sensorWidthMm, sensorHeightMm, focalLengthMm) {
    const diagonalMm = Math.sqrt(sensorWidthMm * sensorWidthMm + sensorHeightMm * sensorHeightMm);
    return {
      horizontalDeg: radToDeg(2 * Math.atan(sensorWidthMm / (2 * focalLengthMm))),
      verticalDeg: radToDeg(2 * Math.atan(sensorHeightMm / (2 * focalLengthMm))),
      diagonalDeg: radToDeg(2 * Math.atan(diagonalMm / (2 * focalLengthMm))),
    };
  }

  function computeCropFactor(sensorWidthMm) {
    return clamp(36 / Math.max(sensorWidthMm, 1), 1, 4);
  }

  function computeDistanceKm(pointA, pointB) {
    const lat1 = degToRad(pointA.latitude);
    const lon1 = degToRad(pointA.longitude);
    const lat2 = degToRad(pointB.latitude);
    const lon2 = degToRad(pointB.longitude);
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function computeBearingDeg(pointA, pointB) {
    const lat1 = degToRad(pointA.latitude);
    const lat2 = degToRad(pointB.latitude);
    const dLon = degToRad(pointB.longitude - pointA.longitude);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (radToDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function buildObjectProfileSvg(profile) {
    const width = 560;
    const height = 300;
    const chartTop = 34;
    const groundY = 226;
    const viewerX = 92;
    const objectX = 332;
    const sunApexX = 446;
    const sunApexY = 98;
    const moonApexX = 500;
    const moonApexY = 132;
    const minElevationM = Math.min(
      profile.observerElevationM,
      profile.objectGroundElevationM,
      profile.totalObjectElevationM,
      profile.sunElevationAslM,
      profile.moonElevationAslM,
      0,
    );
    const maxElevationM = Math.max(
      profile.observerElevationM,
      profile.objectGroundElevationM,
      profile.totalObjectElevationM,
      profile.sunElevationAslM,
      profile.moonElevationAslM,
      0,
    );
    const elevationPaddingM = Math.max(80, (maxElevationM - minElevationM) * 0.1);
    const axisMinM = Math.min(0, minElevationM - elevationPaddingM);
    const axisMaxM = maxElevationM + elevationPaddingM;
    const axisRangeM = Math.max(axisMaxM - axisMinM, 1);
    const toY = (elevationM) => groundY - ((elevationM - axisMinM) / axisRangeM) * (groundY - chartTop);
    const viewerTop = toY(profile.observerElevationM);
    const objectGroundTop = toY(profile.objectGroundElevationM);
    const objectTop = toY(profile.totalObjectElevationM);
    const sunY = clamp(toY(profile.sunElevationAslM), chartTop, groundY);
    const moonY = clamp(toY(profile.moonElevationAslM), chartTop, groundY);
    const zeroY = clamp(toY(0), chartTop, groundY);
    const axisTicks = [0, 0.33, 0.66, 1].map((ratio) => {
      const elevationM = axisMinM + axisRangeM * ratio;
      const y = toY(elevationM);
      return { y, label: `${Math.round(elevationM)} m` };
    });
    const [sunLabelY, moonLabelY] = spreadLabelYs([sunY, moonY], chartTop + 16, groundY - 16, 24);
    const [objectTopLabelY, objectGroundLabelY] = spreadLabelYs([objectTop, objectGroundTop], chartTop + 16, groundY - 16, 24);

    return `
      <defs>
        <linearGradient id="terrainWash" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#fcf6eb" />
          <stop offset="100%" stop-color="#e4d3bc" />
        </linearGradient>
        <radialGradient id="objectSunDisk" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#fff8c8" />
          <stop offset="70%" stop-color="#ffd36a" />
          <stop offset="100%" stop-color="#eaa326" />
        </radialGradient>
        <radialGradient id="objectMoonDisk" cx="38%" cy="32%" r="68%">
          <stop offset="0%" stop-color="#f8f1dd" />
          <stop offset="70%" stop-color="#d9d0bb" />
          <stop offset="100%" stop-color="#97a4bd" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#terrainWash)" />
      <path d="M 24 ${groundY} Q 110 ${groundY - 16} 196 ${groundY - 3} T 536 ${groundY - 8} L 536 ${height} L 24 ${height} Z" fill="rgba(117, 90, 57, 0.16)" />
      <line x1="36" y1="${chartTop}" x2="36" y2="${groundY}" stroke="rgba(41,34,25,0.28)" stroke-width="1.5" />
      ${axisTicks.map((tick) => `<g><line x1="36" y1="${tick.y}" x2="524" y2="${tick.y}" stroke="rgba(41,34,25,0.08)" stroke-width="1" stroke-dasharray="4 6" /><text x="8" y="${tick.y + 4}" fill="#6f675f" font-size="10" font-family="Space Grotesk, sans-serif">${tick.label}</text></g>`).join("")}
      <text x="8" y="24" fill="#6f675f" font-size="10" font-family="Space Grotesk, sans-serif">Elevation ASL</text>
      <line x1="36" y1="${groundY}" x2="524" y2="${groundY}" stroke="rgba(41,34,25,0.22)" stroke-width="2" />
      <line x1="36" y1="${zeroY}" x2="524" y2="${zeroY}" stroke="rgba(41,34,25,0.22)" stroke-width="1" stroke-dasharray="3 5" />
      <text x="484" y="${zeroY - 6}" fill="#6f675f" font-size="10" font-family="Space Grotesk, sans-serif">Sea level</text>
      <line x1="${viewerX}" y1="${viewerTop}" x2="${viewerX}" y2="${groundY}" stroke="#d2612a" stroke-width="8" stroke-linecap="round" />
      <line x1="${objectX}" y1="${objectGroundTop}" x2="${objectX}" y2="${groundY}" stroke="#5779ba" stroke-width="8" stroke-linecap="round" />
      <line x1="${objectX}" y1="${objectTop}" x2="${objectX}" y2="${objectGroundTop}" stroke="#83a9df" stroke-width="8" stroke-linecap="round" />
      <line x1="${viewerX}" y1="${groundY - 24}" x2="${objectX}" y2="${groundY - 24}" stroke="rgba(41,34,25,0.28)" stroke-width="2" stroke-dasharray="6 8" />
      <text x="${(viewerX + objectX) / 2 - 42}" y="${groundY - 32}" fill="#5f554b" font-size="12" font-family="Space Grotesk, sans-serif">${profile.distanceKm.toFixed(2)} km ground</text>
      <text x="${viewerX - 42}" y="${groundY + 20}" fill="#8f441d" font-size="12" font-family="Space Grotesk, sans-serif">Observer</text>
      <text x="${objectX - 32}" y="${groundY + 20}" fill="#315487" font-size="12" font-family="Space Grotesk, sans-serif">Object</text>
      <text x="${viewerX - 58}" y="${viewerTop - 10}" fill="#5f554b" font-size="11" font-family="Space Grotesk, sans-serif">Obs ${Math.round(profile.observerElevationM)} m</text>
      <text x="${objectX + 14}" y="${objectGroundLabelY}" fill="#5f554b" font-size="10" font-family="Space Grotesk, sans-serif">Ground ${Math.round(profile.objectGroundElevationM)} m</text>
      <text x="${objectX + 14}" y="${objectTopLabelY}" fill="#315487" font-size="10" font-family="Space Grotesk, sans-serif">Top ${Math.round(profile.totalObjectElevationM)} m</text>
      <text x="${objectX + 12}" y="${(objectGroundTop + objectTop) / 2 + 4}" fill="#315487" font-size="10" font-family="Space Grotesk, sans-serif">H ${Math.round(profile.objectHeightM)} m</text>
      <line x1="${viewerX}" y1="${viewerTop}" x2="${sunApexX}" y2="${sunY}" stroke="#f1b23b" stroke-width="1.8" stroke-dasharray="6 6" />
      <line x1="${objectX}" y1="${objectTop}" x2="${sunApexX}" y2="${sunY}" stroke="#f1b23b" stroke-width="1.8" stroke-dasharray="6 6" />
      <line x1="${viewerX}" y1="${viewerTop}" x2="${moonApexX}" y2="${moonY}" stroke="#8ea2bf" stroke-width="1.8" stroke-dasharray="6 6" />
      <line x1="${objectX}" y1="${objectTop}" x2="${moonApexX}" y2="${moonY}" stroke="#8ea2bf" stroke-width="1.8" stroke-dasharray="6 6" />
      <line x1="${viewerX}" y1="${viewerTop}" x2="${objectX}" y2="${objectTop}" stroke="rgba(41,34,25,0.28)" stroke-width="1.5" stroke-dasharray="4 6" />
      <line x1="${sunApexX}" y1="${groundY}" x2="${sunApexX}" y2="${sunY}" stroke="rgba(241,178,59,0.35)" stroke-width="2" />
      <line x1="${moonApexX}" y1="${groundY}" x2="${moonApexX}" y2="${moonY}" stroke="rgba(142,162,191,0.38)" stroke-width="2" stroke-dasharray="5 5" />
      <circle cx="${sunApexX}" cy="${sunY}" r="9" fill="url(#objectSunDisk)" />
      <circle cx="${moonApexX}" cy="${moonY}" r="8" fill="url(#objectMoonDisk)" />
      <text x="${sunApexX + 14}" y="${sunLabelY}" fill="#8f441d" font-size="10" font-family="Space Grotesk, sans-serif">Sun ${Math.round(profile.sunElevationAslM)} m</text>
      <text x="${moonApexX + 14}" y="${moonLabelY}" fill="#45607f" font-size="10" font-family="Space Grotesk, sans-serif">Moon ${Math.round(profile.moonElevationAslM)} m</text>
      <text x="42" y="246" fill="#6f675f" font-size="11" font-family="Space Grotesk, sans-serif">${formatTimeWithZone(profile.currentTime, state.timeZone)}</text>
      <text x="42" y="264" fill="#6f675f" font-size="11" font-family="Space Grotesk, sans-serif">Ground angle ${formatAngle(profile.bearingDeg)}</text>
      <text x="42" y="282" fill="#6f675f" font-size="11" font-family="Space Grotesk, sans-serif">Elevation angle ${formatAngle(profile.slopeDeg)}</text>
    `;
  }

  function buildObjectProfileLegend(profile) {
    return [
      {
        title: "Observer",
        rows: [
          ["Elevation", `${Math.round(profile.observerElevationM)} m ASL`],
          ["Vertical to Sun", `${Math.round(profile.sunDeltaFromObserverM)} m`],
          ["Vertical to Moon", `${Math.round(profile.moonDeltaFromObserverM)} m`],
        ],
      },
      {
        title: "Object",
        rows: [
          ["Ground elevation", `${Math.round(profile.objectGroundElevationM)} m ASL`],
          ["Object height", formatMeters(profile.objectHeightM)],
          ["Top elevation", `${Math.round(profile.totalObjectElevationM)} m ASL`],
          ["Vertical to Sun", `${Math.round(profile.sunDeltaFromObjectM)} m`],
          ["Vertical to Moon", `${Math.round(profile.moonDeltaFromObjectM)} m`],
        ],
      },
      {
        title: "Sky bodies",
        rows: [
          ["Sun elevation at object vertical", `${Math.round(profile.sunElevationAslM)} m ASL`],
          ["Sun azimuth gap", formatAngle(Math.abs(profile.sunAzimuthDeltaDeg))],
          ["Sun projected ground distance", `${profile.sunProjectedDistanceKm.toFixed(2)} km`],
          ["Moon elevation at object vertical", `${Math.round(profile.moonElevationAslM)} m ASL`],
          ["Moon azimuth gap", formatAngle(Math.abs(profile.moonAzimuthDeltaDeg))],
          ["Moon projected ground distance", `${profile.moonProjectedDistanceKm.toFixed(2)} km`],
        ],
      },
    ].map((section) => `
      <div class="profile-legend-card">
        <p class="profile-legend-title">${section.title}</p>
        ${section.rows.map(([label, value]) => `<div><span class="sky-label">${label}</span><strong>${value}</strong></div>`).join("")}
      </div>
    `).join("");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function classifySensorFormat(sensorWidthMm) {
    if (sensorWidthMm >= 34) {
      return "Full frame";
    }
    if (sensorWidthMm <= 18.5) {
      return "Micro 4/3";
    }
    return "Crop";
  }

  function degToRad(value) {
    return (value * Math.PI) / 180;
  }

  function altitudeToSkyY(altitudeDeg, horizonY, skyTop) {
    const clampedAltitude = clamp(altitudeDeg, -10, 90);
    const normalized = (clampedAltitude + 10) / 100;
    return horizonY - normalized * (horizonY - skyTop);
  }

  function azimuthToSkyX(azimuthDeg, left, right) {
    const normalized = ((azimuthDeg % 360) + 360) % 360;
    return left + (normalized / 360) * (right - left);
  }

  function radToDeg(value) {
    return (value * 180) / Math.PI;
  }

  function normalizeAngleDelta(value) {
    let angle = value;
    while (angle > 180) {
      angle -= 360;
    }
    while (angle < -180) {
      angle += 360;
    }
    return angle;
  }

  function circleOverlapArea(radiusA, radiusB, distance) {
    if (distance >= radiusA + radiusB) {
      return 0;
    }

    if (distance <= Math.abs(radiusA - radiusB)) {
      const minRadius = Math.min(radiusA, radiusB);
      return Math.PI * minRadius * minRadius;
    }

    const radiusASquared = radiusA * radiusA;
    const radiusBSquared = radiusB * radiusB;
    const alpha = Math.acos((distance * distance + radiusASquared - radiusBSquared) / (2 * distance * radiusA));
    const beta = Math.acos((distance * distance + radiusBSquared - radiusASquared) / (2 * distance * radiusB));

    return radiusASquared * alpha + radiusBSquared * beta - distance * radiusA * Math.sin(alpha);
  }

  function solveOffsetForCoverage(radiusA, radiusB, targetCoverage) {
    if (targetCoverage <= 0) {
      return radiusA + radiusB;
    }
    if (targetCoverage >= 1 && radiusB >= radiusA) {
      return Math.max(0, radiusB - radiusA);
    }

    let low = Math.abs(radiusA - radiusB);
    let high = radiusA + radiusB;

    for (let index = 0; index < 40; index += 1) {
      const mid = (low + high) / 2;
      const coverage = circleOverlapArea(radiusA, radiusB, mid) / (Math.PI * radiusA * radiusA);
      if (coverage > targetCoverage) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return (low + high) / 2;
  }

  function projectDestination(latitude, longitude, azimuthDegrees, distanceKm) {
    const angularDistance = distanceKm / EARTH_RADIUS_KM;
    const bearing = degToRad(azimuthDegrees);
    const lat1 = degToRad(latitude);
    const lon1 = degToRad(longitude);

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const lon2 = lon1 + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

    return {
      latitude: radToDeg(lat2),
      longitude: ((radToDeg(lon2) + 540) % 360) - 180,
    };
  }

  function createSectorPolygon(latitude, longitude, azimuthDegrees, spreadDegrees, distanceKm, steps) {
    const points = [[latitude, longitude]];
    for (let step = 0; step <= steps; step += 1) {
      const bearing = azimuthDegrees - spreadDegrees / 2 + (spreadDegrees * step) / steps;
      const point = projectDestination(latitude, longitude, bearing, distanceKm);
      points.push([point.latitude, point.longitude]);
    }
    points.push([latitude, longitude]);
    return points;
  }
})();