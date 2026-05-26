
const normalizedNetwork = ((import.meta as any).env?.VITE_NETWORK as string | undefined)?.trim().toLowerCase();
export const network: "testnet" | "mainnet" = normalizedNetwork === "mainnet" ? "mainnet" : "testnet";

const DEFAULT_BACKEND_URL = "https://api-nexura.intuition.box";

export const environment = (import.meta as any).env.VITE_ENV as "development" | "production";

function normalizeBackendUrl(value: string | undefined) {
	const trimmed = value?.trim();
	const candidate = trimmed && trimmed.length > 0 ? trimmed : DEFAULT_BACKEND_URL;

	if (/^https?:\/\//i.test(candidate)) {
		return candidate.replace(/\/+$/g, "");
	}

	if (candidate.startsWith("//")) {
		return `https:${candidate}`.replace(/\/+$/g, "");
	}

	return `https://${candidate}`.replace(/\/+$/g, "");
}

const rawBackendUrl = ((import.meta as any).env?.VITE_BACKEND_URL as string | undefined)?.trim();
export const BACKEND_URL = normalizeBackendUrl(rawBackendUrl);

export const AUTHORIZED_ADDRESS = network === "testnet" ? "0x4167E3Afdc91c8b15A16041F813E2a19EAaEcAE0" : "0xF6499B880CcD28080E6aF32A04b9201adCb655a9";

export const LESSON_FEE_CONTRACT_USER = network === "testnet" ? "0x3F68e0b7f2601d4146d1DABaE9b36b56724A0EC6" : "0x95DF721C7582910785BbC4BC23BcbC7140Cc8BF1";

export const LESSON_FEE_CONTRACT_PROJECT = network === "testnet" ? "0x3F68e0b7f2601d4146d1DABaE9b36b56724A0EC6" : "0xc2718280c37E24c6F0b1A77f24f07413755fd21D";

export const QUEST_FEE_CONTRACT = network === "testnet" ? "0x3F68e0b7f2601d4146d1DABaE9b36b56724A0EC6" : "0x1B7d6307E76846c7459FC0D7d09Cadfa33c62a89";

export const MULTIVAULT_ADDRESS = network === "testnet" ? "0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91" : "0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e";

export const url = (import.meta as any).env?.VITE_CLIENT_URL || "https://nexura-app.vercel.app";

export const projectId = (import.meta as any).env?.VITE_REOWN_PROJECT_ID;

const VITE_DISCORD_CLIENT_ID = (import.meta as any).env?.VITE_DISCORD_CLIENT_ID;

export const PROXY_FEE_CONTRACT = (import.meta as any).env?.VITE_PROXY_FEE_CONTRACT;

export const discordAuthUrl = "https://discord.com/oauth2/authorize" + "?client_id=" + VITE_DISCORD_CLIENT_ID + "&redirect_uri=" + encodeURIComponent(BACKEND_URL + "/api/auth/discord/callback") + "&response_type=code" + "&scope=identify";

export const discordHubAuthUrl = "https://discord.com/oauth2/authorize" + "?client_id=" + VITE_DISCORD_CLIENT_ID + "&redirect_uri=" + encodeURIComponent(BACKEND_URL + "/api/hub/discord/callback") + "&response_type=code" + "&scope=identify+guilds+bot+applications.commands";

export const VITE_X_CLIENT_ID = (import.meta as any).env?.VITE_X_CLIENT_ID;

export const NEXONS: Record<number, { address: `0x${string}`, metadata: string }> = {
	1: {
		address: "0x28D5405dA0E2e2476e8EddA08775c61b3B4FeB7d",
		metadata: "ipfs://QmZ1pPLF9m6yGVQMETScwfAKm2ibpt4aZThuv1Dh8NaCCJ"
	},
	2: {
		address: "0xcB5cF742a846AcABba0BE1a85676358C7D4b23De",
		metadata: "ipfs://QmcPL2Wvcwn4qWpKgkyyywnYnDATUSa41cnGDsKkLTuBHW"
	},
	3: {
		address: "0x404b507a362d3D57Dc83528832499D710F97F5A5",
		metadata: "ipfs://QmPU499cvPM7SSvE6QY73sJxfRpog9NrsBd14yW11C5Tm9"
	},
	4: {
		address: "0xDe0c57E2d9A5e0364C17aE0Fc78d3DBFd9810892",
		metadata: "ipfs://QmRedJkCoFPkcdYdoNJvDc1ydHRVZRJNrc4FKXkUqekm67"
	},
	5: {
		address: "0x4424685e92Dad94A175BFF57e2854D3EEA90345b",
		metadata: "ipfs://QmScYrEhTjNzcERwUSXmX66cDCfD3yna8fdiUnLTk8DHEa"
	},
	6: {
		address: "0xc1Da18E2FbE40E644015a651C5F02e6cf05A303E",
		metadata: "ipfs://QmdBrFHCsyxnwEFSuCVTe7tb1dAxxSk9bjNBEodBAs6Cnm"
	},
	7: {
		address: "0x83804749daEb236372056235620A4100fD33C426",
		metadata: "ipfs://QmbmiT1e4Sxf6AJhe3nEBqW6wSqA1UqQRn4Pg92ymiiGNS"
	},
	8: {
		address: "0x07C66482ED8Ff74931D737684EE0466801891078",
		metadata: "ipfs://Qma7hUkq8JmHLPhL12XAzMyYGovnsa34qoag9iXRtuCKnG"
	},
	9: {
		address: "0x231835B2438A1a2a6E0B51aD70EFE954BCB2eF4E",
		metadata: "ipfs://QmNrEQ53aobVuo9nRFJ1CBzzFdkC1QuUXkv7gSAP2RQbGr"
	},
	10: {
		address: "0x9215920DD5d1E5f2F23E148e2735476892269C6A",
		metadata: "ipfs://QmUdsL5f2v6E5iJRupdJBC7qzxHyvdV7qmMkCeTdg7k3As"
	}
};

export const REWARD_BYTECODE = "0x6080604052600260085f6101000a81548160ff02191690836002811115610029576100286101e8565b5b0217905550604051611d59380380611d59833981810160405281019061004f91906103ef565b60015f8190555083341015610090576040517fa4ded24900000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f84148061009d57505f83145b156100d4576040517f706d9bd400000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603610139576040517f63ae907400000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b8160015f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055503360025f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555084600390816101c89190610689565b508060068190555083600781905550826005819055505050505050610758565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602160045260245ffd5b5f604051905090565b5f5ffd5b5f5ffd5b5f5ffd5b5f5ffd5b5f601f19601f8301169050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b6102748261022e565b810181811067ffffffffffffffff821117156102935761029261023e565b5b80604052505050565b5f6102a5610215565b90506102b1828261026b565b919050565b5f67ffffffffffffffff8211156102d0576102cf61023e565b5b6102d98261022e565b9050602081019050919050565b8281835e5f83830152505050565b5f610306610301846102b6565b61029c565b9050828152602081018484840111156103225761032161022a565b5b61032d8482856102e6565b509392505050565b5f82601f83011261034957610348610226565b5b81516103598482602086016102f4565b91505092915050565b5f819050919050565b61037481610362565b811461037e575f5ffd5b50565b5f8151905061038f8161036b565b92915050565b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f6103be82610395565b9050919050565b6103ce816103b4565b81146103d8575f5ffd5b50565b5f815190506103e9816103c5565b92915050565b5f5f5f5f5f60a086880312156104085761040761021e565b5b5f86015167ffffffffffffffff81111561042557610424610222565b5b61043188828901610335565b955050602061044288828901610381565b945050604061045388828901610381565b9350506060610464888289016103db565b925050608061047588828901610381565b9150509295509295909350565b5f81519050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f60028204905060018216806104d057607f821691505b6020821081036104e3576104e261048c565b5b50919050565b5f819050815f5260205f209050919050565b5f6020601f8301049050919050565b5f82821b905092915050565b5f600883026105457fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8261050a565b61054f868361050a565b95508019841693508086168417925050509392505050565b5f819050919050565b5f61058a61058561058084610362565b610567565b610362565b9050919050565b5f819050919050565b6105a383610570565b6105b76105af82610591565b848454610516565b825550505050565b5f5f905090565b6105ce6105bf565b6105d981848461059a565b505050565b5b818110156105fc576105f15f826105c6565b6001810190506105df565b5050565b601f82111561064157610612816104e9565b61061b846104fb565b8101602085101561062a578190505b61063e610636856104fb565b8301826105de565b50505b505050565b5f82821c905092915050565b5f6106615f1984600802610646565b1980831691505092915050565b5f6106798383610652565b9150826002028217905092915050565b61069282610482565b67ffffffffffffffff8111156106ab576106aa61023e565b5b6106b582546104b9565b6106c0828285610600565b5f60209050601f8311600181146106f1575f84156106df578287015190505b6106e9858261066e565b865550610750565b601f1984166106ff866104e9565b5f5b8281101561072657848901518255600182019150602085019450602081019050610701565b86831015610743578489015161073f601f891682610652565b8355505b6001600288020188555050505b505050505050565b6115f4806107655f395ff3fe6080604052600436106100eb575f3560e01c80639330351411610089578063c1ae90c811610058578063c1ae90c8146102e6578063d518b25214610310578063d7557f1814610338578063f7c618c11461034e576100f2565b8063933035141461021e578063b1426fbc1461025a578063b894567014610282578063bb8c9797146102be576100f2565b8063675b0d2b116100c5578063675b0d2b1461018657806374de4ec4146101ae578063750142e6146101ca57806376daefd0146101f4576100f2565b80630b97bc86146100f657806324056c3a1461012057806331116a221461015c576100f2565b366100f257005b5f5ffd5b348015610101575f5ffd5b5061010a610378565b6040516101179190610f08565b60405180910390f35b34801561012b575f5ffd5b506101466004803603810190610141919061106e565b61037e565b60405161015391906110cf565b60405180910390f35b348015610167575f5ffd5b506101706103b3565b60405161017d9190611148565b60405180910390f35b348015610191575f5ffd5b506101ac60048036038101906101a7919061106e565b61043f565b005b6101c860048036038101906101c39190611192565b610600565b005b3480156101d5575f5ffd5b506101de6106c3565b6040516101eb9190610f08565b60405180910390f35b3480156101ff575f5ffd5b506102086106c9565b60405161021591906111fc565b60405180910390f35b348015610229575f5ffd5b50610244600480360381019061023f919061106e565b6106ee565b60405161025191906110cf565b60405180910390f35b348015610265575f5ffd5b50610280600480360381019061027b919061106e565b610723565b005b34801561028d575f5ffd5b506102a860048036038101906102a3919061106e565b6108a6565b6040516102b591906110cf565b60405180910390f35b3480156102c9575f5ffd5b506102e460048036038101906102df919061106e565b6108db565b005b3480156102f1575f5ffd5b506102fa610bbe565b6040516103079190610f08565b60405180910390f35b34801561031b575f5ffd5b5061033660048036038101906103319190611192565b610bc4565b005b348015610343575f5ffd5b5061034c610c09565b005b348015610359575f5ffd5b50610362610e94565b60405161036f9190610f08565b60405180910390f35b60065481565b600b818051602081018201805184825260208301602085012081835280955050505050505f915054906101000a900460ff1681565b600380546103c090611242565b80601f01602080910402602001604051908101604052809291908181526020018280546103ec90611242565b80156104375780601f1061040e57610100808354040283529160200191610437565b820191905f5260205f20905b81548152906001019060200180831161041a57829003601f168201915b505050505081565b60015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146104c5576040517fc036d81400000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f60028111156104d8576104d7611272565b5b60085f9054906101000a900460ff1660028111156104f9576104f8611272565b5b03610530576040517f8a2a7d5200000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b600b8160405161054091906112d9565b90815260200160405180910390205f9054906101000a900460ff1615610592576040517fd7769fca00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6001600b826040516105a491906112d9565b90815260200160405180910390205f6101000a81548160ff0219169083151502179055507f9200a5bed86c0176a00489a57d80e1d78e0110b0f2b968a16bec97ae8392692e6040516105f590611339565b60405180910390a150565b5f8103610639576040517f5fb4932700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b80341015610673576040517f2945404800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b8060075f8282546106849190611384565b925050819055507fc45e77742e6ab0ca691053252f927f1251cecb3a6f2ad8f96379a693806400846040516106b890611427565b60405180910390a150565b60075481565b60025f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6009818051602081018201805184825260208301602085012081835280955050505050505f915054906101000a900460ff1681565b60015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146107a9576040517fc036d81400000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b600a816040516107b991906112d9565b90815260200160405180910390205f9054906101000a900460ff161561080b576040517f22b57f2c00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60098160405161081b91906112d9565b90815260200160405180910390205f9054906101000a900460ff161561086d576040517ff9e9b97300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b600160098260405161087f91906112d9565b90815260200160405180910390205f6101000a81548160ff02191690831515021790555050565b600a818051602081018201805184825260208301602085012081835280955050505050505f915054906101000a900460ff1681565b6108e3610e9a565b60065442101561091f576040517f8a2a7d5200000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6001600281111561093357610932611272565b5b60085f9054906101000a900460ff16600281111561095457610953611272565b5b0361098b576040517f85b1d52800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f47116109c4576040517f8e61340e00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6009816040516109d491906112d9565b90815260200160405180910390205f9054906101000a900460ff16610a25576040517f0e19019300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b600a81604051610a3591906112d9565b90815260200160405180910390205f9054906101000a900460ff1615610a87576040517f22b57f2c00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f3390505f8173ffffffffffffffffffffffffffffffffffffffff16600554604051610ab290611472565b5f6040518083038185875af1925050503d805f8114610aec576040519150601f19603f3d011682016040523d82523d5f602084013e610af1565b606091505b5050905080610b2c576040517ffdc8f34700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6001600a84604051610b3e91906112d9565b90815260200160405180910390205f6101000a81548160ff02191690831515021790555060055460045f828254610b759190611384565b925050819055507f732583c12e13eb2361ef4c2656704fbc4cc6641de25b036bc2675afcf05e8b0c604051610ba9906114d0565b60405180910390a15050610bbb610ee7565b50565b60045481565b8060065410610bff576040517fca40f91700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b8060068190555050565b60025f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610c8f576040517f4e313ccc00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60016002811115610ca357610ca2611272565b5b60085f9054906101000a900460ff166002811115610cc457610cc3611272565b5b03610cfb576040517f2a99784d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f6002811115610d0e57610d0d611272565b5b60085f9054906101000a900460ff166002811115610d2f57610d2e611272565b5b03610d66576040517faec186ab00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f4790505f8114610e33575f60025f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1682604051610db790611472565b5f6040518083038185875af1925050503d805f8114610df1576040519150601f19603f3d011682016040523d82523d5f602084013e610df6565b606091505b5050905080610e31576040517fc4710e8d00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b505b5f60085f6101000a81548160ff02191690836002811115610e5757610e56611272565b5b02179055507f674fa62341c20f70c3f2cc6cb2f4bb98ab610c1c22382dc73ad60797f7989be6604051610e8990611538565b60405180910390a150565b60055481565b60025f5403610ede576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610ed5906115a0565b60405180910390fd5b60025f81905550565b60015f81905550565b5f819050919050565b610f0281610ef0565b82525050565b5f602082019050610f1b5f830184610ef9565b92915050565b5f604051905090565b5f5ffd5b5f5ffd5b5f5ffd5b5f5ffd5b5f601f19601f8301169050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b610f8082610f3a565b810181811067ffffffffffffffff82111715610f9f57610f9e610f4a565b5b80604052505050565b5f610fb1610f21565b9050610fbd8282610f77565b919050565b5f67ffffffffffffffff821115610fdc57610fdb610f4a565b5b610fe582610f3a565b9050602081019050919050565b828183375f83830152505050565b5f61101261100d84610fc2565b610fa8565b90508281526020810184848401111561102e5761102d610f36565b5b611039848285610ff2565b509392505050565b5f82601f83011261105557611054610f32565b5b8135611065848260208601611000565b91505092915050565b5f6020828403121561108357611082610f2a565b5b5f82013567ffffffffffffffff8111156110a05761109f610f2e565b5b6110ac84828501611041565b91505092915050565b5f8115159050919050565b6110c9816110b5565b82525050565b5f6020820190506110e25f8301846110c0565b92915050565b5f81519050919050565b5f82825260208201905092915050565b8281835e5f83830152505050565b5f61111a826110e8565b61112481856110f2565b9350611134818560208601611102565b61113d81610f3a565b840191505092915050565b5f6020820190508181035f8301526111608184611110565b905092915050565b61117181610ef0565b811461117b575f5ffd5b50565b5f8135905061118c81611168565b92915050565b5f602082840312156111a7576111a6610f2a565b5b5f6111b48482850161117e565b91505092915050565b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f6111e6826111bd565b9050919050565b6111f6816111dc565b82525050565b5f60208201905061120f5f8301846111ed565b92915050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f600282049050600182168061125957607f821691505b60208210810361126c5761126b611215565b5b50919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602160045260245ffd5b5f81905092915050565b5f6112b3826110e8565b6112bd818561129f565b93506112cd818560208601611102565b80840191505092915050565b5f6112e482846112a9565b915081905092915050565b7f63616d706169676e206a6f696e656400000000000000000000000000000000005f82015250565b5f611323600f836110f2565b915061132e826112ef565b602082019050919050565b5f6020820190508181035f83015261135081611317565b9050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f61138e82610ef0565b915061139983610ef0565b92508282019050808211156113b1576113b0611357565b5b92915050565b7f746f6b656e207265776172642075706461746564207375636365737366756c6c5f8201527f7921000000000000000000000000000000000000000000000000000000000000602082015250565b5f6114116022836110f2565b915061141c826113b7565b604082019050919050565b5f6020820190508181035f83015261143e81611405565b9050919050565b5f81905092915050565b50565b5f61145d5f83611445565b91506114688261144f565b5f82019050919050565b5f61147c82611452565b9150819050919050565b7f7265776172647320636c61696d6564207375636365737366756c6c79000000005f82015250565b5f6114ba601c836110f2565b91506114c582611486565b602082019050919050565b5f6020820190508181035f8301526114e7816114ae565b9050919050565b7f63616d706169676e20686173206265656e20636c6f73656400000000000000005f82015250565b5f6115226018836110f2565b915061152d826114ee565b602082019050919050565b5f6020820190508181035f83015261154f81611516565b9050919050565b7f5265656e7472616e637947756172643a207265656e7472616e742063616c6c005f82015250565b5f61158a601f836110f2565b915061159582611556565b602082019050919050565b5f6020820190508181035f8301526115b78161157e565b905091905056fea2646970667358221220928f963e8cbbd2daf25be33ebb9bcd0ea7a5e2052dd6215bca56967c400bcdbd64736f6c634300081f0033";

export const REWARD_ABI = [
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_nameOfCampaign",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "_totalReward",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_rewardToken",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "_authorizedAddress",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_startDate",
				"type": "uint256"
			}
		],
		"stateMutability": "payable",
		"type": "constructor"
	},
	{
		"inputs": [],
		"name": "AddressCannotBeNull",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "AlreadyClaimedCampaignReward",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "AlreadyJoinedCampaign",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "CampaignCanOnlyBeCreatedOnce",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "CampaignHasEnded",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "CampaignHasNotBeenStarted",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "CampaignIsAlreadyClosed",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "CannotCloseAnEndedCampaign",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "CompleteCampaignToClaimReward",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "FailedToRefundReward",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "NewDateIsSupposedToBeGreaterThanOldDate",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "OnlyTheAuthorizedAddressCanCallThis",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "OnlyTheCampaignCreatorCanCallThis",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "RewardClaimFailed",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "RewardHasBeenExhausted",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "SendExactPoolAmount",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "SendTheRequiredAmount",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "TokensToAddCannotBeZero",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "TotalRewardOrRewardTokenCannotBeZero",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "UserCanAlreadyClaimReward",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "string",
				"name": "message",
				"type": "string"
			}
		],
		"name": "CampaignClosed",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "string",
				"name": "message",
				"type": "string"
			}
		],
		"name": "CampaignCreated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "string",
				"name": "message",
				"type": "string"
			}
		],
		"name": "CampaignJoined",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "string",
				"name": "message",
				"type": "string"
			}
		],
		"name": "RewardsClaimed",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "string",
				"name": "message",
				"type": "string"
			}
		],
		"name": "UpdatedTokenRewards",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "userId",
				"type": "string"
			}
		],
		"name": "AllowCampaignRewardClaim",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokensToAdd",
				"type": "uint256"
			}
		],
		"name": "addReward",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "campaignCreator",
		"outputs": [
			{
				"internalType": "address payable",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"name": "canClaim",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "userId",
				"type": "string"
			}
		],
		"name": "claimReward",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"name": "claimed",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "closeCampaign",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "userId",
				"type": "string"
			}
		],
		"name": "joinCampaign",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"name": "joined",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "nameOfCampaign",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "rewardToken",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "rewardsClaimed",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "startDate",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "totalReward",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "newDate",
				"type": "uint256"
			}
		],
		"name": "updateDate",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"stateMutability": "payable",
		"type": "receive"
	}
];

export const NEXONS_ABI = [
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "name_",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "symbol_",
				"type": "string"
			},
			{
				"internalType": "address",
				"name": "_authorizedAddress",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [],
		"name": "AlreadyAllowedToMint",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "CannotMintToZeroAddress",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "CannotTransferSoulboundNFT",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"name": "ERC721IncorrectOwner",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "operator",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "ERC721InsufficientApproval",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "approver",
				"type": "address"
			}
		],
		"name": "ERC721InvalidApprover",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "operator",
				"type": "address"
			}
		],
		"name": "ERC721InvalidOperator",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"name": "ERC721InvalidOwner",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "receiver",
				"type": "address"
			}
		],
		"name": "ERC721InvalidReceiver",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "sender",
				"type": "address"
			}
		],
		"name": "ERC721InvalidSender",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "ERC721NonexistentToken",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "NexonAlreadyMinted",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "userId",
				"type": "string"
			}
		],
		"name": "NotAllowedToMint",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "OnlyTheAuthorizedAddressCanCallThis",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"name": "OwnableInvalidOwner",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "OwnableUnauthorizedAccount",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "TokenUriIsRequired",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "minter",
				"type": "address"
			}
		],
		"name": "WalletAlreadyHasNexon",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "approved",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "Approval",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "operator",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "approved",
				"type": "bool"
			}
		],
		"name": "ApprovalForAll",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "_fromTokenId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "_toTokenId",
				"type": "uint256"
			}
		],
		"name": "BatchMetadataUpdate",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "_tokenId",
				"type": "uint256"
			}
		],
		"name": "MetadataUpdate",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "NexonMinted",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "previousOwner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "OwnershipTransferred",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "Transfer",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "string",
				"name": "message",
				"type": "string"
			}
		],
		"name": "UserAllowedToMint",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "userId",
				"type": "string"
			}
		],
		"name": "allowUserToMint",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "approve",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"name": "balanceOf",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "burn",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "getApproved",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "operator",
				"type": "address"
			}
		],
		"name": "isApprovedForAll",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "metadataURI",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "userId",
				"type": "string"
			}
		],
		"name": "mint",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "mintedUsers",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "name",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "ownerOf",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "renounceOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "safeTransferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			},
			{
				"internalType": "bytes",
				"name": "data",
				"type": "bytes"
			}
		],
		"name": "safeTransferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "operator",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "approved",
				"type": "bool"
			}
		],
		"name": "setApprovalForAll",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes4",
				"name": "interfaceId",
				"type": "bytes4"
			}
		],
		"name": "supportsInterface",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "symbol",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "tokenURI",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "transferFrom",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
];

export const PROXY_CONTRACT_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_ethMultiVault",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_feeRecipient",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_depositFixedFee",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_depositPercentageFee",
        "type": "uint256"
      },
      {
        "internalType": "address[]",
        "name": "_initialAdmins",
        "type": "address[]"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "IntuitionFeeProxy_FeePercentageTooHigh",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "IntuitionFeeProxy_InsufficientValue",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "IntuitionFeeProxy_InvalidMultiVaultAddress",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "IntuitionFeeProxy_InvalidMultisigAddress",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "IntuitionFeeProxy_NotWhitelistedAdmin",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "IntuitionFeeProxy_TransferFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "IntuitionFeeProxy_WrongArrayLengths",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "IntuitionFeeProxy_ZeroAddress",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "admin",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "status",
        "type": "bool"
      }
    ],
    "name": "AdminWhitelistUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "oldFee",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newFee",
        "type": "uint256"
      }
    ],
    "name": "DepositFixedFeeUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "oldFee",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newFee",
        "type": "uint256"
      }
    ],
    "name": "DepositPercentageFeeUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "oldRecipient",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newRecipient",
        "type": "address"
      }
    ],
    "name": "FeeRecipientUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "operation",
        "type": "string"
      }
    ],
    "name": "FeesCollected",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "operation",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "resultCount",
        "type": "uint256"
      }
    ],
    "name": "MultiVaultSuccess",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "operation",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "fee",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "multiVaultValue",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalReceived",
        "type": "uint256"
      }
    ],
    "name": "TransactionForwarded",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "FEE_DENOMINATOR",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_FEE_PERCENTAGE",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "calculateAtomId",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "depositCount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "totalDeposit",
        "type": "uint256"
      }
    ],
    "name": "calculateDepositFee",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "subjectId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "predicateId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "objectId",
        "type": "bytes32"
      }
    ],
    "name": "calculateTripleId",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "internalType": "bytes[]",
        "name": "data",
        "type": "bytes[]"
      },
      {
        "internalType": "uint256[]",
        "name": "assets",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      }
    ],
    "name": "createAtoms",
    "outputs": [
      {
        "internalType": "bytes32[]",
        "name": "atomIds",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "internalType": "bytes32[]",
        "name": "subjectIds",
        "type": "bytes32[]"
      },
      {
        "internalType": "bytes32[]",
        "name": "predicateIds",
        "type": "bytes32[]"
      },
      {
        "internalType": "bytes32[]",
        "name": "objectIds",
        "type": "bytes32[]"
      },
      {
        "internalType": "uint256[]",
        "name": "assets",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      }
    ],
    "name": "createTriples",
    "outputs": [
      {
        "internalType": "bytes32[]",
        "name": "tripleIds",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "minShares",
        "type": "uint256"
      }
    ],
    "name": "deposit",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "shares",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "internalType": "bytes32[]",
        "name": "termIds",
        "type": "bytes32[]"
      },
      {
        "internalType": "uint256[]",
        "name": "curveIds",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256[]",
        "name": "assets",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256[]",
        "name": "minShares",
        "type": "uint256[]"
      }
    ],
    "name": "depositBatch",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "shares",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "depositFixedFee",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "depositPercentageFee",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "ethMultiVault",
    "outputs": [
      {
        "internalType": "contract IEthMultiVault",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "feeRecipient",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAtomCost",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "msgValue",
        "type": "uint256"
      }
    ],
    "name": "getMultiVaultAmountFromValue",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      }
    ],
    "name": "getShares",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "depositCount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "totalDeposit",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "multiVaultCost",
        "type": "uint256"
      }
    ],
    "name": "getTotalCreationCost",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "depositAmount",
        "type": "uint256"
      }
    ],
    "name": "getTotalDepositCost",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "tripleId",
        "type": "bytes32"
      }
    ],
    "name": "getTriple",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTripleCost",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "id",
        "type": "bytes32"
      }
    ],
    "name": "isTermCreated",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "termId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "curveId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "assets",
        "type": "uint256"
      }
    ],
    "name": "previewDeposit",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "newFee",
        "type": "uint256"
      }
    ],
    "name": "setDepositFixedFee",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "newFee",
        "type": "uint256"
      }
    ],
    "name": "setDepositPercentageFee",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newRecipient",
        "type": "address"
      }
    ],
    "name": "setFeeRecipient",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "admin",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "status",
        "type": "bool"
      }
    ],
    "name": "setWhitelistedAdmin",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "whitelistedAdmins",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
];

export const MULTIVAULT_ABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"AccessControlBadConfirmation","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"bytes32","name":"neededRole","type":"bytes32"}],"name":"AccessControlUnauthorizedAccount","type":"error"},{"inputs":[],"name":"EnforcedPause","type":"error"},{"inputs":[],"name":"ExpectedPause","type":"error"},{"inputs":[],"name":"FailedCall","type":"error"},{"inputs":[{"internalType":"uint256","name":"balance","type":"uint256"},{"internalType":"uint256","name":"needed","type":"uint256"}],"name":"InsufficientBalance","type":"error"},{"inputs":[],"name":"InvalidInitialization","type":"error"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"}],"name":"MultiVaultCore_AtomDoesNotExist","type":"error"},{"inputs":[],"name":"MultiVaultCore_InvalidAdmin","type":"error"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"}],"name":"MultiVaultCore_TermDoesNotExist","type":"error"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"}],"name":"MultiVaultCore_TripleDoesNotExist","type":"error"},{"inputs":[],"name":"MultiVault_ActionExceedsMaxAssets","type":"error"},{"inputs":[],"name":"MultiVault_ActionExceedsMaxShares","type":"error"},{"inputs":[],"name":"MultiVault_ArraysNotSameLength","type":"error"},{"inputs":[],"name":"MultiVault_AtomDataTooLong","type":"error"},{"inputs":[{"internalType":"bytes32","name":"atomId","type":"bytes32"}],"name":"MultiVault_AtomDoesNotExist","type":"error"},{"inputs":[{"internalType":"bytes","name":"atomData","type":"bytes"}],"name":"MultiVault_AtomExists","type":"error"},{"inputs":[],"name":"MultiVault_BurnFromZeroAddress","type":"error"},{"inputs":[],"name":"MultiVault_BurnInsufficientBalance","type":"error"},{"inputs":[],"name":"MultiVault_CannotApproveOrRevokeSelf","type":"error"},{"inputs":[],"name":"MultiVault_CannotDirectlyInitializeCounterTriple","type":"error"},{"inputs":[],"name":"MultiVault_DefaultCurveMustBeInitializedViaCreatePaths","type":"error"},{"inputs":[],"name":"MultiVault_DepositBelowMinimumDeposit","type":"error"},{"inputs":[],"name":"MultiVault_DepositOrRedeemZeroShares","type":"error"},{"inputs":[],"name":"MultiVault_DepositTooSmallToCoverMinShares","type":"error"},{"inputs":[],"name":"MultiVault_EpochNotTracked","type":"error"},{"inputs":[],"name":"MultiVault_HasCounterStake","type":"error"},{"inputs":[],"name":"MultiVault_InsufficientAssets","type":"error"},{"inputs":[],"name":"MultiVault_InsufficientBalance","type":"error"},{"inputs":[{"internalType":"uint256","name":"remainingShares","type":"uint256"}],"name":"MultiVault_InsufficientRemainingSharesInVault","type":"error"},{"inputs":[],"name":"MultiVault_InsufficientSharesInVault","type":"error"},{"inputs":[],"name":"MultiVault_InvalidArrayLength","type":"error"},{"inputs":[],"name":"MultiVault_InvalidEpoch","type":"error"},{"inputs":[],"name":"MultiVault_NoAtomDataProvided","type":"error"},{"inputs":[],"name":"MultiVault_OnlyAssociatedAtomWallet","type":"error"},{"inputs":[],"name":"MultiVault_RedeemerNotApproved","type":"error"},{"inputs":[],"name":"MultiVault_SenderNotApproved","type":"error"},{"inputs":[],"name":"MultiVault_SlippageExceeded","type":"error"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"}],"name":"MultiVault_TermDoesNotExist","type":"error"},{"inputs":[],"name":"MultiVault_TermNotTriple","type":"error"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"},{"internalType":"bytes32","name":"subjectId","type":"bytes32"},{"internalType":"bytes32","name":"predicateId","type":"bytes32"},{"internalType":"bytes32","name":"objectId","type":"bytes32"}],"name":"MultiVault_TripleExists","type":"error"},{"inputs":[],"name":"NotInitializing","type":"error"},{"inputs":[],"name":"ReentrancyGuardReentrantCall","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"receiver","type":"address"},{"indexed":false,"internalType":"enum ApprovalTypes","name":"approvalType","type":"uint8"}],"name":"ApprovalTypeUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"atomCreationProtocolFee","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"atomWalletDepositFee","type":"uint256"}],"name":"AtomConfigUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"creator","type":"address"},{"indexed":true,"internalType":"bytes32","name":"termId","type":"bytes32"},{"indexed":false,"internalType":"bytes","name":"atomData","type":"bytes"},{"indexed":false,"internalType":"address","name":"atomWallet","type":"address"}],"name":"AtomCreated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"termId","type":"bytes32"},{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"AtomWalletDepositFeeCollected","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"termId","type":"bytes32"},{"indexed":true,"internalType":"address","name":"atomWalletOwner","type":"address"},{"indexed":true,"internalType":"uint256","name":"feesClaimed","type":"uint256"}],"name":"AtomWalletDepositFeesClaimed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"registry","type":"address"},{"indexed":false,"internalType":"uint256","name":"defaultCurveId","type":"uint256"}],"name":"BondingCurveConfigUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"receiver","type":"address"},{"indexed":true,"internalType":"bytes32","name":"termId","type":"bytes32"},{"indexed":false,"internalType":"uint256","name":"curveId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"assets","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"assetsAfterFees","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"shares","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"totalShares","type":"uint256"},{"indexed":false,"internalType":"enum VaultType","name":"vaultType","type":"uint8"}],"name":"Deposited","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"admin","type":"address"},{"indexed":true,"internalType":"address","name":"protocolMultisig","type":"address"},{"indexed":false,"internalType":"uint256","name":"feeDenominator","type":"uint256"},{"indexed":true,"internalType":"address","name":"trustBonding","type":"address"},{"indexed":false,"internalType":"uint256","name":"minDeposit","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"minShare","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"atomDataMaxLength","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"feeThreshold","type":"uint256"}],"name":"GeneralConfigUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint64","name":"version","type":"uint64"}],"name":"Initialized","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Paused","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"uint256","name":"epoch","type":"uint256"},{"indexed":true,"internalType":"int256","name":"valueAdded","type":"int256"},{"indexed":false,"internalType":"int256","name":"personalUtilization","type":"int256"}],"name":"PersonalUtilizationAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"uint256","name":"epoch","type":"uint256"},{"indexed":true,"internalType":"int256","name":"valueRemoved","type":"int256"},{"indexed":false,"internalType":"int256","name":"personalUtilization","type":"int256"}],"name":"PersonalUtilizationRemoved","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"epoch","type":"uint256"},{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"ProtocolFeeAccrued","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"epoch","type":"uint256"},{"indexed":true,"internalType":"address","name":"destination","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"ProtocolFeeTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"receiver","type":"address"},{"indexed":true,"internalType":"bytes32","name":"termId","type":"bytes32"},{"indexed":false,"internalType":"uint256","name":"curveId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"shares","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"totalShares","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"assets","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"fees","type":"uint256"},{"indexed":false,"internalType":"enum VaultType","name":"vaultType","type":"uint8"}],"name":"Redeemed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"termId","type":"bytes32"},{"indexed":true,"internalType":"uint256","name":"curveId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"sharePrice","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"totalAssets","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"totalShares","type":"uint256"},{"indexed":false,"internalType":"enum VaultType","name":"vaultType","type":"uint8"}],"name":"SharePriceChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"epoch","type":"uint256"},{"indexed":true,"internalType":"int256","name":"valueAdded","type":"int256"},{"indexed":true,"internalType":"int256","name":"totalUtilization","type":"int256"}],"name":"TotalUtilizationAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"epoch","type":"uint256"},{"indexed":true,"internalType":"int256","name":"valueRemoved","type":"int256"},{"indexed":true,"internalType":"int256","name":"totalUtilization","type":"int256"}],"name":"TotalUtilizationRemoved","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"tripleCreationProtocolFee","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"atomDepositFractionForTriple","type":"uint256"}],"name":"TripleConfigUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"creator","type":"address"},{"indexed":true,"internalType":"bytes32","name":"termId","type":"bytes32"},{"indexed":false,"internalType":"bytes32","name":"subjectId","type":"bytes32"},{"indexed":false,"internalType":"bytes32","name":"predicateId","type":"bytes32"},{"indexed":false,"internalType":"bytes32","name":"objectId","type":"bytes32"}],"name":"TripleCreated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Unpaused","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"entryFee","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"exitFee","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"protocolFee","type":"uint256"}],"name":"VaultFeesUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"entryPoint","type":"address"},{"indexed":true,"internalType":"address","name":"atomWarden","type":"address"},{"indexed":true,"internalType":"address","name":"atomWalletBeacon","type":"address"},{"indexed":false,"internalType":"address","name":"atomWalletFactory","type":"address"}],"name":"WalletConfigUpdated","type":"event"},{"inputs":[],"name":"ATOM_SALT","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"BURN_ADDRESS","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"COUNTER_SALT","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MAX_BATCH_SIZE","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"TRIPLE_SALT","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"atomWallet","type":"address"}],"name":"accumulatedAtomWalletDepositFees","outputs":[{"internalType":"uint256","name":"accumulatedFees","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"epoch","type":"uint256"}],"name":"accumulatedProtocolFees","outputs":[{"internalType":"uint256","name":"accumulatedFees","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"enum ApprovalTypes","name":"approvalType","type":"uint8"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"atomId","type":"bytes32"}],"name":"atom","outputs":[{"internalType":"bytes","name":"data","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"atomConfig","outputs":[{"internalType":"uint256","name":"atomCreationProtocolFee","type":"uint256"},{"internalType":"uint256","name":"atomWalletDepositFee","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"assets","type":"uint256"}],"name":"atomDepositFractionAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"bondingCurveConfig","outputs":[{"internalType":"address","name":"registry","type":"address"},{"internalType":"uint256","name":"defaultCurveId","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes","name":"data","type":"bytes"}],"name":"calculateAtomId","outputs":[{"internalType":"bytes32","name":"id","type":"bytes32"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"bytes32","name":"subjectId","type":"bytes32"},{"internalType":"bytes32","name":"predicateId","type":"bytes32"},{"internalType":"bytes32","name":"objectId","type":"bytes32"}],"name":"calculateCounterTripleId","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"bytes32","name":"subjectId","type":"bytes32"},{"internalType":"bytes32","name":"predicateId","type":"bytes32"},{"internalType":"bytes32","name":"objectId","type":"bytes32"}],"name":"calculateTripleId","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"}],"name":"claimAtomWalletDepositFees","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"atomId","type":"bytes32"}],"name":"computeAtomWalletAddr","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"},{"internalType":"uint256","name":"curveId","type":"uint256"},{"internalType":"uint256","name":"shares","type":"uint256"}],"name":"convertToAssets","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"},{"internalType":"uint256","name":"curveId","type":"uint256"},{"internalType":"uint256","name":"assets","type":"uint256"}],"name":"convertToShares","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes[]","name":"data","type":"bytes[]"},{"internalType":"uint256[]","name":"assets","type":"uint256[]"}],"name":"createAtoms","outputs":[{"internalType":"bytes32[]","name":"","type":"bytes32[]"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"bytes32[]","name":"subjectIds","type":"bytes32[]"},{"internalType":"bytes32[]","name":"predicateIds","type":"bytes32[]"},{"internalType":"bytes32[]","name":"objectIds","type":"bytes32[]"},{"internalType":"uint256[]","name":"assets","type":"uint256[]"}],"name":"createTriples","outputs":[{"internalType":"bytes32[]","name":"","type":"bytes32[]"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"currentEpoch","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"},{"internalType":"uint256","name":"curveId","type":"uint256"}],"name":"currentSharePrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"},{"internalType":"bytes32","name":"termId","type":"bytes32"},{"internalType":"uint256","name":"curveId","type":"uint256"},{"internalType":"uint256","name":"minShares","type":"uint256"}],"name":"deposit","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"},{"internalType":"bytes32[]","name":"termIds","type":"bytes32[]"},{"internalType":"uint256[]","name":"curveIds","type":"uint256[]"},{"internalType":"uint256[]","name":"assets","type":"uint256[]"},{"internalType":"uint256[]","name":"minShares","type":"uint256[]"}],"name":"depositBatch","outputs":[{"internalType":"uint256[]","name":"shares","type":"uint256[]"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"assets","type":"uint256"}],"name":"entryFeeAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"assets","type":"uint256"}],"name":"exitFeeAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"generalConfig","outputs":[{"internalType":"address","name":"admin","type":"address"},{"internalType":"address","name":"protocolMultisig","type":"address"},{"internalType":"uint256","name":"feeDenominator","type":"uint256"},{"internalType":"address","name":"trustBonding","type":"address"},{"internalType":"uint256","name":"minDeposit","type":"uint256"},{"internalType":"uint256","name":"minShare","type":"uint256"},{"internalType":"uint256","name":"atomDataMaxLength","type":"uint256"},{"internalType":"uint256","name":"feeThreshold","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"atomId","type":"bytes32"}],"name":"getAtom","outputs":[{"internalType":"bytes","name":"data","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getAtomConfig","outputs":[{"components":[{"internalType":"uint256","name":"atomCreationProtocolFee","type":"uint256"},{"internalType":"uint256","name":"atomWalletDepositFee","type":"uint256"}],"internalType":"struct AtomConfig","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getAtomCost","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getAtomWarden","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getBondingCurveConfig","outputs":[{"components":[{"internalType":"address","name":"registry","type":"address"},{"internalType":"uint256","name":"defaultCurveId","type":"uint256"}],"internalType":"struct BondingCurveConfig","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"tripleId","type":"bytes32"}],"name":"getCounterIdFromTripleId","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getGeneralConfig","outputs":[{"components":[{"internalType":"address","name":"admin","type":"address"},{"internalType":"address","name":"protocolMultisig","type":"address"},{"internalType":"uint256","name":"feeDenominator","type":"uint256"},{"internalType":"address","name":"trustBonding","type":"address"},{"internalType":"uint256","name":"minDeposit","type":"uint256"},{"internalType":"uint256","name":"minShare","type":"uint256"},{"internalType":"uint256","name":"atomDataMaxLength","type":"uint256"},{"internalType":"uint256","name":"feeThreshold","type":"uint256"}],"internalType":"struct GeneralConfig","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"tripleId","type":"bytes32"}],"name":"getInverseTripleId","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"bytes32","name":"termId","type":"bytes32"},{"internalType":"uint256","name":"curveId","type":"uint256"}],"name":"getShares","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"epoch","type":"uint256"}],"name":"getTotalUtilizationForEpoch","outputs":[{"internalType":"int256","name":"","type":"int256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"tripleId","type":"bytes32"}],"name":"getTriple","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"},{"internalType":"bytes32","name":"","type":"bytes32"},{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getTripleConfig","outputs":[{"components":[{"internalType":"uint256","name":"tripleCreationProtocolFee","type":"uint256"},{"internalType":"uint256","name":"atomDepositFractionForTriple","type":"uint256"}],"internalType":"struct TripleConfig","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getTripleCost","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"counterId","type":"bytes32"}],"name":"getTripleIdFromCounterId","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getUserLastActiveEpoch","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"epoch","type":"uint256"}],"name":"getUserUtilizationForEpoch","outputs":[{"internalType":"int256","name":"","type":"int256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"epoch","type":"uint256"}],"name":"getUserUtilizationInEpoch","outputs":[{"internalType":"int256","name":"","type":"int256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"},{"internalType":"uint256","name":"curveId","type":"uint256"}],"name":"getVault","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getVaultFees","outputs":[{"components":[{"internalType":"uint256","name":"entryFee","type":"uint256"},{"internalType":"uint256","name":"exitFee","type":"uint256"},{"internalType":"uint256","name":"protocolFee","type":"uint256"}],"internalType":"struct VaultFees","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"}],"name":"getVaultType","outputs":[{"internalType":"enum VaultType","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getWalletConfig","outputs":[{"components":[{"internalType":"address","name":"entryPoint","type":"address"},{"internalType":"address","name":"atomWarden","type":"address"},{"internalType":"address","name":"atomWalletBeacon","type":"address"},{"internalType":"address","name":"atomWalletFactory","type":"address"}],"internalType":"struct WalletConfig","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"admin","type":"address"},{"internalType":"address","name":"protocolMultisig","type":"address"},{"internalType":"uint256","name":"feeDenominator","type":"uint256"},{"internalType":"address","name":"trustBonding","type":"address"},{"internalType":"uint256","name":"minDeposit","type":"uint256"},{"internalType":"uint256","name":"minShare","type":"uint256"},{"internalType":"uint256","name":"atomDataMaxLength","type":"uint256"},{"internalType":"uint256","name":"feeThreshold","type":"uint256"}],"internalType":"struct GeneralConfig","name":"_generalConfig","type":"tuple"},{"components":[{"internalType":"uint256","name":"atomCreationProtocolFee","type":"uint256"},{"internalType":"uint256","name":"atomWalletDepositFee","type":"uint256"}],"internalType":"struct AtomConfig","name":"_atomConfig","type":"tuple"},{"components":[{"internalType":"uint256","name":"tripleCreationProtocolFee","type":"uint256"},{"internalType":"uint256","name":"atomDepositFractionForTriple","type":"uint256"}],"internalType":"struct TripleConfig","name":"_tripleConfig","type":"tuple"},{"components":[{"internalType":"address","name":"entryPoint","type":"address"},{"internalType":"address","name":"atomWarden","type":"address"},{"internalType":"address","name":"atomWalletBeacon","type":"address"},{"internalType":"address","name":"atomWalletFactory","type":"address"}],"internalType":"struct WalletConfig","name":"_walletConfig","type":"tuple"},{"components":[{"internalType":"uint256","name":"entryFee","type":"uint256"},{"internalType":"uint256","name":"exitFee","type":"uint256"},{"internalType":"uint256","name":"protocolFee","type":"uint256"}],"internalType":"struct VaultFees","name":"_vaultFees","type":"tuple"},{"components":[{"internalType":"address","name":"registry","type":"address"},{"internalType":"uint256","name":"defaultCurveId","type":"uint256"}],"internalType":"struct BondingCurveConfig","name":"_bondingCurveConfig","type":"tuple"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"atomId","type":"bytes32"}],"name":"isAtom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"}],"name":"isCounterTriple","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"id","type":"bytes32"}],"name":"isTermCreated","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"}],"name":"isTriple","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"bytes32","name":"termId","type":"bytes32"},{"internalType":"uint256","name":"curveId","type":"uint256"}],"name":"maxRedeem","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"epoch","type":"uint256"}],"name":"personalUtilization","outputs":[{"internalType":"int256","name":"utilizationAmount","type":"int256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"},{"internalType":"uint256","name":"assets","type":"uint256"}],"name":"previewAtomCreate","outputs":[{"internalType":"uint256","name":"shares","type":"uint256"},{"internalType":"uint256","name":"assetsAfterFixedFees","type":"uint256"},{"internalType":"uint256","name":"assetsAfterFees","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"},{"internalType":"uint256","name":"curveId","type":"uint256"},{"internalType":"uint256","name":"assets","type":"uint256"}],"name":"previewDeposit","outputs":[{"internalType":"uint256","name":"shares","type":"uint256"},{"internalType":"uint256","name":"assetsAfterFees","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"},{"internalType":"uint256","name":"curveId","type":"uint256"},{"internalType":"uint256","name":"shares","type":"uint256"}],"name":"previewRedeem","outputs":[{"internalType":"uint256","name":"assetsAfterFees","type":"uint256"},{"internalType":"uint256","name":"sharesUsed","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"termId","type":"bytes32"},{"internalType":"uint256","name":"assets","type":"uint256"}],"name":"previewTripleCreate","outputs":[{"internalType":"uint256","name":"shares","type":"uint256"},{"internalType":"uint256","name":"assetsAfterFixedFees","type":"uint256"},{"internalType":"uint256","name":"assetsAfterFees","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"assets","type":"uint256"}],"name":"protocolFeeAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"},{"internalType":"bytes32","name":"termId","type":"bytes32"},{"internalType":"uint256","name":"curveId","type":"uint256"},{"internalType":"uint256","name":"shares","type":"uint256"},{"internalType":"uint256","name":"minAssets","type":"uint256"}],"name":"redeem","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"},{"internalType":"bytes32[]","name":"termIds","type":"bytes32[]"},{"internalType":"uint256[]","name":"curveIds","type":"uint256[]"},{"internalType":"uint256[]","name":"shares","type":"uint256[]"},{"internalType":"uint256[]","name":"minAssets","type":"uint256[]"}],"name":"redeemBatch","outputs":[{"internalType":"uint256[]","name":"received","type":"uint256[]"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"callerConfirmation","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"uint256","name":"atomCreationProtocolFee","type":"uint256"},{"internalType":"uint256","name":"atomWalletDepositFee","type":"uint256"}],"internalType":"struct AtomConfig","name":"_atomConfig","type":"tuple"}],"name":"setAtomConfig","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"registry","type":"address"},{"internalType":"uint256","name":"defaultCurveId","type":"uint256"}],"internalType":"struct BondingCurveConfig","name":"_bondingCurveConfig","type":"tuple"}],"name":"setBondingCurveConfig","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"admin","type":"address"},{"internalType":"address","name":"protocolMultisig","type":"address"},{"internalType":"uint256","name":"feeDenominator","type":"uint256"},{"internalType":"address","name":"trustBonding","type":"address"},{"internalType":"uint256","name":"minDeposit","type":"uint256"},{"internalType":"uint256","name":"minShare","type":"uint256"},{"internalType":"uint256","name":"atomDataMaxLength","type":"uint256"},{"internalType":"uint256","name":"feeThreshold","type":"uint256"}],"internalType":"struct GeneralConfig","name":"_generalConfig","type":"tuple"}],"name":"setGeneralConfig","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"uint256","name":"tripleCreationProtocolFee","type":"uint256"},{"internalType":"uint256","name":"atomDepositFractionForTriple","type":"uint256"}],"internalType":"struct TripleConfig","name":"_tripleConfig","type":"tuple"}],"name":"setTripleConfig","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"uint256","name":"entryFee","type":"uint256"},{"internalType":"uint256","name":"exitFee","type":"uint256"},{"internalType":"uint256","name":"protocolFee","type":"uint256"}],"internalType":"struct VaultFees","name":"_vaultFees","type":"tuple"}],"name":"setVaultFees","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"entryPoint","type":"address"},{"internalType":"address","name":"atomWarden","type":"address"},{"internalType":"address","name":"atomWalletBeacon","type":"address"},{"internalType":"address","name":"atomWalletFactory","type":"address"}],"internalType":"struct WalletConfig","name":"_walletConfig","type":"tuple"}],"name":"setWalletConfig","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"epoch","type":"uint256"}],"name":"sweepAccumulatedProtocolFees","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"totalTermsCreated","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"epoch","type":"uint256"}],"name":"totalUtilization","outputs":[{"internalType":"int256","name":"utilizationAmount","type":"int256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"tripleId","type":"bytes32"}],"name":"triple","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"},{"internalType":"bytes32","name":"","type":"bytes32"},{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"tripleConfig","outputs":[{"internalType":"uint256","name":"tripleCreationProtocolFee","type":"uint256"},{"internalType":"uint256","name":"atomDepositFractionForTriple","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"unpause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"userEpochHistory","outputs":[{"internalType":"uint256","name":"epoch","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"vaultFees","outputs":[{"internalType":"uint256","name":"entryFee","type":"uint256"},{"internalType":"uint256","name":"exitFee","type":"uint256"},{"internalType":"uint256","name":"protocolFee","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"walletConfig","outputs":[{"internalType":"address","name":"entryPoint","type":"address"},{"internalType":"address","name":"atomWarden","type":"address"},{"internalType":"address","name":"atomWalletBeacon","type":"address"},{"internalType":"address","name":"atomWalletFactory","type":"address"}],"stateMutability":"view","type":"function"}];
