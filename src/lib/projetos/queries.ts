import { queryOptions } from '@tanstack/react-query';
import { listProjects, getProject, projectOptions } from '@/lib/projetos.functions';
export const projectsQuery = (userId:string) => queryOptions({queryKey:['projects',userId],queryFn:()=>listProjects()});
export const projectQuery = (userId:string,id:string) => queryOptions({queryKey:['projects',userId,id],queryFn:()=>getProject({data:{id}})});
export const optionsQuery = (userId:string) => queryOptions({queryKey:['project-options',userId],queryFn:()=>projectOptions()});
