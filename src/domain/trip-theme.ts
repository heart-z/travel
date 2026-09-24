export type TripTheme='forest'|'frost'|'urban'|'coast'|'classic';

export function tripTheme(destination:string):TripTheme{
 const name=destination.toLowerCase();
 if(/阿尔山|呼伦贝尔|森林|草原|林区/.test(name))return 'forest';
 if(/哈尔滨|北海道|雪|冰|长白山/.test(name))return 'frost';
 if(/上海|北京|香港|东京|城市/.test(name))return 'urban';
 if(/青岛|三亚|厦门|海边|海岛|海口/.test(name))return 'coast';
 return 'classic';
}
