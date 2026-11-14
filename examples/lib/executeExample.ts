import { stopAnvilForks } from '../../test/anvil/anvil-global-setup';

const executeExample = async (filePath) => {
    const exampleModule = await import(`../../${filePath}`);
    const example = exampleModule.default;
    await example();
    await stopAnvilForks();
    process.exit(0);
};

executeExample(process.argv[2]);
