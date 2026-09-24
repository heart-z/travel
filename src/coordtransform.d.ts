declare module 'coordtransform' {
  const transform:{wgs84togcj02:(lon:number,lat:number)=>[number,number];gcj02towgs84:(lon:number,lat:number)=>[number,number]};
  export default transform;
}
