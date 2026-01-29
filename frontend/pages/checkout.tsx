import Head from 'next/head'

export default function Checkout() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <Head>
        <title>Checkout - Mekong AgencyOS</title>
      </Head>

      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden md:max-w-lg">
        <div className="md:flex">
          <div className="w-full px-6 py-8 md:p-8">
            <h2 className="text-2xl font-bold text-gray-800">Checkout</h2>
            <p className="mt-2 text-sm text-gray-600">Complete your purchase for AgencyOS Enterprise.</p>

            <form className="mt-6">
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                  Email Address
                </label>
                <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="email" type="email" placeholder="you@example.com" />
              </div>

              <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" type="button">
                Pay $995.00
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
