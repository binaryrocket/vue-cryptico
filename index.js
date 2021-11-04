import { cryptico } from './api';

export const VueCryptico = {
	install(Vue) {
		Vue.prototype.$cryptico = cryptico;
	}
};
