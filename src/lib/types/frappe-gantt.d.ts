declare module 'frappe-gantt' {
 export default class Gantt {
  constructor(element:HTMLElement,tasks:{id:string;name:string;start:string;end:string;progress:number;dependencies:string;custom_class?:string}[],options:Record<string,unknown>);
 }
}
