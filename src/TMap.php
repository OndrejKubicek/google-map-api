<?php

namespace Oli\GoogleAPI;


trait TMap
{

	/**
	 * @var IMapAPI
	 */
	protected $googleMapAPI;

	/**
	 * @var IMarkers
	 */
	protected $googleMapMarkers;


	/**
	 * @param \Cestolino\GoogleAPI\IMapAPI $mapApi
	 */
	public function injectGoogleMapApi(IMapAPI $mapApi)
	{
		$this->googleMapAPI = $mapApi;
	}
	
	
	/**
	 * @param \Cestolino\GoogleAPI\IMarkers $markers
	 */
	public function injectGoogleMapMarkers(IMarkers $markers)
	{
		$this->googleMapMarkers = $markers;
	}
	
	
	/**
	 * @return MapAPI
	 */
	public function createComponentMap()
	{
		$map = $this->googleMapAPI->create();
		$map->addMarkers($this->googleMapMarkers->create());
		return $map;
	}
	
}
