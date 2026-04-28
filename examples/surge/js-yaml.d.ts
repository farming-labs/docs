declare module "js-yaml" {
  export function load(source: string): unknown;

  const yaml: {
    load: typeof load;
  };

  export default yaml;
}
