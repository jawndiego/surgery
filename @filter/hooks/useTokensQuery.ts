import { getAddress } from '@ethersproject/address'
import { zdk } from '@shared/utils/zdk'
import { transformNFTZDK } from '@zoralabs/nft-hooks/dist/backends'
import { prepareJson } from '@zoralabs/nft-hooks/dist/fetcher/NextUtils'
import { NFTObject } from '@zoralabs/nft-hooks/dist/types/NFTInterface'
import { TokensQueryArgs } from '@zoralabs/zdk'
import {
  TokenSortInput,
  TokensQueryFilter,
  TokensQueryInput,
} from '@zoralabs/zdk/dist/queries/queries-sdk'
import { flatten } from 'lodash'
import { useCallback } from 'react'
import useSWRInfinite from 'swr/infinite'

const PAGE_SIZE = 24

export interface UseTokenQueryProps {
  contractAllowList?: string[] | undefined
  contractAddress?: string | null
  ownerAddress?: string
  initialData?: NFTObject[]
  sort?: TokenSortInput
  filter?: TokensQueryFilter
  where?: TokensQueryInput
}

type GetNFTReturnType = {
  tokens: NFTObject[]
  nextCursor?: string | null
}

async function getNFTs(query: TokensQueryArgs): Promise<GetNFTReturnType> {
  const resp = await zdk.tokens(query)
  const tokens = resp.tokens.nodes
    /* @ts-ignore */
    .map((token) => transformNFTZDK(token, { rawData: token }))
    .map(prepareJson)
  return {
    tokens,
    nextCursor: resp.tokens.pageInfo.endCursor,
  }
}

export function useTokensQuery({
  contractAllowList,
  contractAddress,
  ownerAddress,
  sort,
  filter,
  where,
}: // initialData,
UseTokenQueryProps) {
  const getKey = (pageIndex: number, previousPageData: GetNFTReturnType) => {
    if (pageIndex > 0 && !previousPageData.nextCursor) return null // reached the end
    return {
      where: {
        ...(contractAddress && {
          collectionAddresses: ownerAddress
            ? contractAllowList
            : getAddress(contractAddress),
        }),
        ...(ownerAddress && {
          collectionAddresses: contractAllowList,
          ownerAddresses: [getAddress(ownerAddress)],
        }),
        ...where,
      },
      sort,
      filter,
      pagination: {
        after: previousPageData?.nextCursor,
        limit: PAGE_SIZE,
      },
      includeFullDetails: true,
    }
  }

  const {
    data: resp,
    error,
    setSize,
    size,
    isValidating,
  } = useSWRInfinite<GetNFTReturnType>(getKey, getNFTs, {
    // fallbackData: [initialData],
    refreshInterval: 5000,
  })

  const data = resp?.map((r) => r.tokens)

  const handleLoadMore = useCallback(() => setSize(size + 1), [setSize, size])

  const isLoadingInitialData = !data && !error
  const isLoadingMore =
    isLoadingInitialData || (size > 0 && data && typeof data[size - 1] === 'undefined')
  const isEmpty = data?.[0]?.length === 0
  const isReachingEnd = isEmpty || (data && data[data.length - 1]?.length < PAGE_SIZE)
  const isRefreshing = isValidating && data && data.length === size

  return {
    data: flatten(data),
    isValidating,
    isRefreshing,
    isLoadingMore,
    isReachingEnd,
    isEmpty,
    handleLoadMore,
  }
}
